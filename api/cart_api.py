from flask import Blueprint, session, request, jsonify
from database.db import products_collection
from bson.objectid import ObjectId
from datetime import datetime, timedelta, timezone
import uuid
from utils.sse import announcer, format_sse
import json

cart_bp = Blueprint("cart", __name__)

tw_tz = timezone(timedelta(hours=8))

# 加入購物車
@cart_bp.route("/api/cart/add", methods=["POST"])
def add_to_cart():    
    current_hour = datetime.now(tw_tz).hour
    if not (6 <= current_hour < 24):
        return jsonify({"message": "目前非點餐時間 (06:00-24:00)"}), 400

    data = request.json
    item_id = str(data.get("product_id"))
    quantity = int(data.get("quantity", 1))

    if not item_id:
        return jsonify({"message": "缺少 product_id"}), 400

    item = None
    warning_msg = None

    try:
        # 直接查詢商品資料庫
        item = products_collection.find_one({"_id": ObjectId(item_id)})
        
        if item:
            # === 庫存檢查邏輯 ===
            cart = session.get("cart", {})
            current_qty_in_cart = cart.get(item_id, {}).get("quantity", 0)
            
            if item["stock"] < (current_qty_in_cart + quantity):
                return jsonify({
                    "message": f"庫存不足！目前剩餘 {item['stock']}，您購物車已有 {current_qty_in_cart}"
                }), 400
            
            # === 庫存預警 ===
            if item["stock"] < 5:
                warning_msg = f"注意：{item['name']} 即將售完"
            
    except Exception as e:
        return jsonify({"message": "無效的 ID"}), 400

    if not item:
        return jsonify({"message": "商品不存在"}), 404

    # 3. 更新購物車 (Session)
    cart = session.get("cart", {})
    
    if item_id in cart:
        cart[item_id]["quantity"] += quantity
    else:
        cart[item_id] = {
            "name": item["name"],
            "price": item["price"],
            "quantity": quantity,
            "image_id": str(item.get("image_id", ""))
        }
    
    session["cart"] = cart

    # 4. 回傳結果
    response_data = {
        "message": f"{item['name']} 已加入購物車", 
        "cart": cart
    }
    
    if warning_msg:
        response_data["warning"] = warning_msg
        
    return jsonify(response_data)

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

    note = request.json.get("note", "")

    # === 1. 執行扣庫存 (含防超賣邏輯) ===
    deducted_log = [] 

    try:
        for item_id, item in cart.items():
            qty = int(item["quantity"])
            
            # 直接扣除該商品庫存 (不再區分套餐或單品)
            result = products_collection.update_one(
                {"_id": ObjectId(item_id), "stock": {"$gte": qty}},
                {"$inc": {"stock": -qty}}
            )
            
            if result.modified_count == 0:
                raise Exception(f"商品「{item['name']}」庫存不足，剛好被搶光了！")
            
            deducted_log.append((item_id, qty))

    except Exception as e:
        # === 錯誤處理：回滾 (Rollback) ===
        for pid, q in deducted_log:
            products_collection.update_one(
                {"_id": ObjectId(pid)}, 
                {"$inc": {"stock": q}}
            )
        return jsonify({"message": f"結帳失敗：{str(e)}"}), 400

    # === 2. 計算總價 + 產生訂單 ===
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
        "created_at": datetime.now(timezone.utc)
    }
    orders_collection.insert_one(order_data)

    # === 3. 發送 SSE 即時通知 (通知管理員) ===
    try:
        msg_payload = json.dumps({
            "order_id": order_id,
            "total": total,
            "time": datetime.now().strftime("%H:%M")
        })
        announcer.announce(format_sse(data=msg_payload, event="new_order"))
    except Exception as sse_err:
        print(f"SSE 通知發送失敗: {sse_err}") 

    # === 4. 清空購物車並回傳 ===
    session.pop("cart")

    return jsonify({
        "message": f"結帳成功！訂單編號：{order_id}",
        "order_id": order_id,
        "total": total,
        "note": note,
        "created_at": order_data["created_at"].isoformat()
    })