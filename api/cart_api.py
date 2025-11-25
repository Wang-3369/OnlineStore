from flask import Blueprint, session, request, jsonify
from database.db import products_collection  # 商品 collection
from bson.objectid import ObjectId
from datetime import datetime, time, timezone   
import uuid

cart_bp = Blueprint("cart", __name__)

# 加入購物車
@cart_bp.route("/api/cart/add", methods=["POST"])
def add_to_cart():
    now = datetime.now(timezone.utc).astimezone()
    current_hour = datetime.now().hour
    if not (6 <= current_hour < 24):
        return jsonify({"message": "目前非點餐時間 (06:00-24:00)"}), 400

    data = request.json
    product_id = str(data.get("product_id"))
    quantity = int(data.get("quantity", 1))

    if not product_id:
        return jsonify({"message": "缺少 product_id"}), 400

    try:
        product = products_collection.find_one({"_id": ObjectId(product_id)})
    except:
        return jsonify({"message": "無效的 product_id"}), 400

    if not product:
        return jsonify({"message": "商品不存在"}), 404

    cart = session.get("cart", {})
    if product_id in cart:
        cart[product_id]["quantity"] += quantity
    else:
        cart[product_id] = {
            "name": product["name"],
            "price": product["price"],
            "quantity": quantity
        }
    session["cart"] = cart
    return jsonify({"message": f"{product['name']} 已加入購物車", "cart": cart})

# 更新購物車數量
@cart_bp.route("/api/cart/update", methods=["POST"])
def update_cart():
    data = request.json
    product_id = str(data.get("product_id"))
    quantity = int(data.get("quantity", 1))
    cart = session.get("cart", {})

    if product_id in cart:
        if quantity <= 0:
            cart.pop(product_id)
        else:
            cart[product_id]["quantity"] = quantity
        session["cart"] = cart
    return jsonify({"cart": cart})

# 刪除購物車商品
@cart_bp.route("/api/cart/remove", methods=["POST"])
def remove_cart_item():
    product_id = str(request.json.get("product_id"))
    cart = session.get("cart", {})
    if product_id in cart:
        cart.pop(product_id)
        session["cart"] = cart
    return jsonify({"cart": cart})

# 取得購物車內容
@cart_bp.route("/api/cart", methods=["GET"])
def get_cart():
    cart = session.get("cart", {})
    return jsonify({"cart": cart})

from database.db import orders_collection  # 新增：訂單 collection

# 結帳，產生訂單編號並存入 MongoDB
@cart_bp.route("/api/cart/checkout", methods=["POST"])
def checkout():
    cart = session.get("cart", {})
    username = session.get("username")

    if not cart:
        return jsonify({"message": "購物車為空"}), 400
    if not username:
        return jsonify({"message": "尚未登入"}), 403
    
    pickup_time = request.json.get("pickup_time")
    if not pickup_time:
         return jsonify({"message": "請選擇取餐時間"}), 400

    #取得備註（可為空）
    note = request.json.get("note", "")

    # === 1. 結帳前先檢查庫存 ===
    for product_id, item in cart.items():
        product = products_collection.find_one({"_id": ObjectId(product_id)})
        if not product:
            return jsonify({"message": f"商品 {item['name']} 不存在"}), 400

        if product["stock"] < item["quantity"]:
            return jsonify({
                "message": f"商品「{item['name']}」庫存不足",
                "stock": product["stock"],
                "need": item["quantity"]
            }), 400

    # === 2. 庫存足夠 → 逐筆扣庫存 ===
    for product_id, item in cart.items():
        products_collection.update_one(
            {"_id": ObjectId(product_id)},
            {"$inc": {"stock": -item["quantity"]}}
        )

    # === 3. 計算總價 + 產生訂單 ===
    total = sum(float(item["price"]) * int(item["quantity"]) for item in cart.values())
    order_id = str(uuid.uuid4())[:8]

    order_data = {
        "order_id": order_id,
        "username": username,
        "products": cart,
        "total": total,
        "pickup_time": pickup_time,
        "note": note,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)  # <- 新增訂單建立時間
    }
    orders_collection.insert_one(order_data)

    # === 4. 清空購物車 ===
    session.pop("cart")

    return jsonify({
        "message": f"結帳成功！訂單編號：{order_id}",
        "order_id": order_id,
        "total": total,
        "note": note,
        "created_at": order_data["created_at"].isoformat()  # 回傳 ISO 字串
    })
    