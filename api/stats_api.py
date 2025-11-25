from flask import Blueprint, request, jsonify, send_file
from database.db import orders_collection, products_collection
from datetime import datetime
from collections import defaultdict
from bson import ObjectId
import csv
import io

stats_api = Blueprint("stats_api", __name__)

# ------------------------
# 工具函數
# ------------------------
def parse_date(s):
    """解析日期字串，格式 YYYY-MM-DD"""
    try:
        return datetime.strptime(s, "%Y-%m-%d")
    except:
        return None

def build_query(start=None, end=None, include_pending=False):
    """建立 MongoDB 查詢條件"""
    query = {}
    # 日期範圍
    if start and end:
        query["created_at"] = {"$gte": start, "$lte": end}
    # 完成狀態
    if not include_pending:
        query["status"] = "completed"
    return query

# ------------------------
# 1. 商品銷售量（長條圖）
# ------------------------
@stats_api.route("/api/stats/products")
def stats_products():
    start = parse_date(request.args.get("start"))
    end = parse_date(request.args.get("end"))
    include_pending = request.args.get("include_pending", "false").lower() == "true"

    query = build_query(start, end, include_pending)
    orders = orders_collection.find(query)

    product_sales = defaultdict(int)
    for order in orders:
        for pid, info in order.get("products", {}).items():
            product_sales[pid] += info.get("quantity", 0)

    result = []
    for pid, qty in product_sales.items():
        try:
            product = products_collection.find_one({"_id": ObjectId(pid)})
            name = product["name"] if product else "未知商品"
        except:
            name = "未知商品"
        result.append({"product_id": str(pid), "name": name, "quantity": qty})

    return jsonify(result)

# ------------------------
# 2. 每日營收（折線圖）
# ------------------------
@stats_api.route("/api/stats/revenue")
def stats_revenue():
    start = parse_date(request.args.get("start"))
    end = parse_date(request.args.get("end"))
    include_pending = request.args.get("include_pending", "false").lower() == "true"

    query = build_query(start, end, include_pending)
    orders = orders_collection.find(query)

    revenue = defaultdict(float)
    for order in orders:
        date_str = order["created_at"].strftime("%Y-%m-%d")
        revenue[date_str] += order.get("total", 0)

    result = [{"date": d, "revenue": revenue[d]} for d in sorted(revenue.keys())]
    return jsonify(result)

# ------------------------
# 3. 圓餅圖：商品占比
# ------------------------
@stats_api.route("/api/stats/pie")
def stats_pie():
    start = parse_date(request.args.get("start"))
    end = parse_date(request.args.get("end"))
    include_pending = request.args.get("include_pending", "false").lower() == "true"

    query = build_query(start, end, include_pending)
    orders = orders_collection.find(query)

    sales = defaultdict(int)
    for order in orders:
        for pid, info in order.get("products", {}).items():
            sales[pid] += info.get("quantity", 0)

    result = []
    for pid, qty in sales.items():
        try:
            product = products_collection.find_one({"_id": ObjectId(pid)})
            name = product["name"] if product else "未知商品"
        except:
            name = "未知商品"
        result.append({"name": name, "value": qty})

    return jsonify(result)

# ------------------------
# 4. CSV 下載
# ------------------------
@stats_api.route("/api/stats/export")
def stats_export():
    start = parse_date(request.args.get("start"))
    end = parse_date(request.args.get("end"))
    include_pending = request.args.get("include_pending", "false").lower() == "true"

    query = build_query(start, end, include_pending)
    orders = orders_collection.find(query)

    output = io.StringIO()
    output.write("\ufeff")  # Excel 中文 BOM
    writer = csv.writer(output)
    writer.writerow(["訂單編號", "用戶", "總額", "日期", "取貨時間", "狀態"])

    for order in orders:
        writer.writerow([
            order.get("order_id", ""),
            order.get("username", ""),
            order.get("total", 0),
            order.get("created_at").strftime("%Y/%m/%d"),
            order.get("pickup_time", ""),
            order.get("status", "completed")
        ])

    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        mimetype="text/csv",
        as_attachment=True,
        download_name="sales.csv"
    )

# ------------------------
# 5. 清理訂單
# ------------------------
@stats_api.route("/api/stats/clear_orders", methods=["POST"])
def clear_orders():
    """
    刪除指定類型的訂單
    type:
        completed -> 已完成訂單
        pending   -> 未完成訂單
        missing   -> 缺失 status 的訂單
    """
    data = request.get_json() or {}
    order_type = data.get("type", "pending")

    if order_type == "completed":
        query = {"status": "completed"}
    elif order_type == "pending":
        query = {"status": {"$ne": "completed"}}
    elif order_type == "missing":
        query = {"status": {"$exists": False}}
    else:
        return jsonify({"deleted_count": 0, "error": "未知類型"}), 400

    result = orders_collection.delete_many(query)
    return jsonify({"deleted_count": result.deleted_count})

# ------------------------
# 6. 每日訂單數量（長條圖）
# ------------------------
@stats_api.route("/api/stats/orders_by_date_products")
def stats_orders_by_date_products():
    start = parse_date(request.args.get("start"))
    end = parse_date(request.args.get("end"))
    include_pending = request.args.get("include_pending", "false").lower() == "true"

    query = build_query(start, end, include_pending)
    orders = list(orders_collection.find(query))

    # 找出所有日期
    all_dates = sorted({order["created_at"].strftime("%Y-%m-%d") for order in orders})

    # 建立 product -> date -> quantity
    product_sales = defaultdict(lambda: defaultdict(int))
    for order in orders:
        date_str = order["created_at"].strftime("%Y-%m-%d")
        for pid, info in order.get("products", {}).items():
            product_sales[pid][date_str] += info.get("quantity", 0)

    result = []
    for pid, date_qty in product_sales.items():
        try:
            product = products_collection.find_one({"_id": ObjectId(pid)})
            name = product["name"] if product else "未知商品"
        except:
            name = "未知商品"

        # 對每個日期都填入數量，缺失日期補 0
        quantities = [date_qty.get(d, 0) for d in all_dates]
        result.append({"product_id": str(pid), "name": name, "quantities": quantities})

    return jsonify({"labels": all_dates, "datasets": result})

