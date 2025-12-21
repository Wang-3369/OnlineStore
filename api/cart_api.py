from flask import Blueprint, session, request, jsonify
from database.db import products_collection, orders_collection, promotions_collection
from bson.objectid import ObjectId
from datetime import datetime, timedelta, timezone
import uuid
import json

cart_bp = Blueprint("cart", __name__)

# 設定台灣時區
tw_tz = timezone(timedelta(hours=8))

# --- 加入購物車 ---
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

    try:
        item = products_collection.find_one({"_id": ObjectId(item_id)})
        if not item:
            return jsonify({"message": "商品不存在"}), 404

        cart = session.get("cart", {})
        current_qty_in_cart = cart.get(item_id, {}).get("quantity", 0)
        
        if item["stock"] < (current_qty_in_cart + quantity):
            return jsonify({
                "message": f"庫存不足！目前剩餘 {item['stock']}，您購物車已有 {current_qty_in_cart}"
            }), 400
            
    except Exception:
        return jsonify({"message": "無效的商品 ID"}), 400

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
    return jsonify({"message": f"{item['name']} 已加入購物車", "cart": cart})

# --- 取得購物車 ---
@cart_bp.route("/api/cart", methods=["GET"])
def get_cart():
    cart = session.get("cart", {})
    for p_id in list(cart.keys()):
        product = products_collection.find_one({"_id": ObjectId(p_id)})
        if product:
            cart[p_id]["category"] = product.get("category", "")
    return jsonify({"cart": cart})

# --- 更新與刪除 ---
@cart_bp.route("/api/cart/update", methods=["POST"])
def update_cart():
    data = request.json
    product_id, quantity = str(data.get("product_id")), int(data.get("quantity", 1))
    cart = session.get("cart", {})
    if product_id in cart:
        if quantity <= 0: cart.pop(product_id)
        else: cart[product_id]["quantity"] = quantity
        session["cart"] = cart
    return jsonify({"cart": cart})

@cart_bp.route("/api/cart/remove", methods=["POST"])
def remove_cart_item():
    product_id = str(request.json.get("product_id"))
    cart = session.get("cart", {})
    if product_id in cart:
        cart.pop(product_id)
        session["cart"] = cart
    return jsonify({"cart": cart})

# --- 結帳 (Pusher 整合版) ---
@cart_bp.route("/api/cart/checkout", methods=["POST"])
def checkout():
    # 在函式內導入以防止循環導入
    from app import pusher_client

    cart = session.get("cart", {})
    username = session.get("username")

    if not cart: return jsonify({"message": "購物車為空"}), 400
    if not username: return jsonify({"message": "尚未登入"}), 403
    
    data = request.json
    gmail = data.get("gmail")
    pickup_time = data.get("pickup_time")
    note = data.get("note", "")

    full_cart_items = []
    grand_subtotal = 0
    deducted_log = []

    try:
        # 1. 庫存處理
        for pid, item in cart.items():
            qty = int(item["quantity"])
            res = products_collection.update_one(
                {"_id": ObjectId(pid), "stock": {"$gte": qty}},
                {"$inc": {"stock": -qty}}
            )
            if res.modified_count == 0:
                raise Exception(f"商品「{item['name']}」庫存不足")
            
            deducted_log.append((pid, qty))
            product = products_collection.find_one({"_id": ObjectId(pid)})
            item_total = float(item["price"]) * qty
            full_cart_items.append({
                "product_id": pid,
                "name": item["name"],
                "category": str(product.get("category", "")).strip(),
                "subtotal": item_total,
                "quantity": qty
            })
            grand_subtotal += item_total

        # 2. 促銷計算
        all_promos = list(promotions_collection.find())
        best_final_total = grand_subtotal
        applied_promo = None
        for promo in all_promos:
            threshold = float(promo.get("threshold", 0))
            scope_type = promo.get("scope_type", "all")
            scope_val = str(promo.get("scope_value", "")).strip()
            eligible_amount = 0
            for item in full_cart_items:
                if scope_type == "all" or \
                   (scope_type == "category" and item["category"] == scope_val) or \
                   (scope_type == "product" and item["product_id"] == scope_val):
                    eligible_amount += item["subtotal"]
            if eligible_amount >= threshold and eligible_amount > 0:
                p_type, p_val = promo.get("promo_type"), float(promo.get("promo_value", 0))
                discount_amt = eligible_amount * (1 - p_val) if p_type == "discount" else p_val
                current_total = grand_subtotal - discount_amt
                if current_total < best_final_total:
                    best_final_total = max(0, current_total)
                    applied_promo = {"title": promo.get("title"), "discount_value": round(discount_amt, 2)}

        final_total = round(best_final_total)
        discount_amount = round(grand_subtotal - final_total, 2)

        # 3. 存入訂單
        order_id = str(uuid.uuid4())[:8]
        order_data = {
            "order_id": order_id,
            "username": username,
            "email": gmail,
            "products": cart,
            "subtotal": grand_subtotal,
            "discount_amount": discount_amount,
            "total": final_total,
            "promo_info": applied_promo,
            "pickup_time": pickup_time,
            "note": note,
            "status": "pending",
            "created_at": datetime.now(timezone.utc)
        }
        orders_collection.insert_one(order_data)

        # 4. 改用 Pusher 即時通知管理員
        try:
            pusher_client.trigger('admin-channel', 'new-order', {
                "order_id": order_id,
                "username": username,
                "total": final_total,
                "time": datetime.now(tw_tz).strftime("%H:%M")
            })
        except Exception as pusher_err:
            print(f"Pusher 通知發送失敗: {pusher_err}")

        session.pop("cart")
        return jsonify({
            "message": "結帳成功！",
            "order_id": order_id,
            "final_total": final_total,
            "promo_applied": applied_promo["title"] if applied_promo else "無"
        })

    except Exception as e:
        for pid, q in deducted_log:
            products_collection.update_one({"_id": ObjectId(pid)}, {"$inc": {"stock": q}})
        return jsonify({"message": f"結帳失敗：{str(e)}"}), 400