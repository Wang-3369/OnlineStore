from flask import Blueprint, session, request, jsonify
from database.db import products_collection,orders_collection, promotions_collection  # 商品 collection
from bson.objectid import ObjectId
from datetime import datetime, time, timezone   
import uuid

cart_bp = Blueprint("cart", __name__)

# 加入購物車
@cart_bp.route("/api/cart/add", methods=["POST"])
def add_to_cart():
    now = datetime.now(timezone.utc).astimezone()
    current_hour = datetime.now().hour
    if not (4 <= current_hour < 24):
        return jsonify({"message": "目前非點餐時間 (04:00-24:00)"}), 400

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
    # 為了讓前端能計算，我們補上 category
    for p_id in cart:
        product = products_collection.find_one({"_id": ObjectId(p_id)})
        if product:
            cart[p_id]["category"] = product.get("category", "")
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
    
    data = request.json
    gmail = data.get("gmail")
    pickup_time = data.get("pickup_time")
    note = data.get("note", "")

    # === 1. 抓取完整資訊並計算原始總價 ===
    full_cart_items = []
    grand_subtotal = 0

    for product_id, item in cart.items():
        product = products_collection.find_one({"_id": ObjectId(product_id)})
        if not product:
            continue # 預防商品突然被刪除
        
        if product["stock"] < item["quantity"]:
            return jsonify({"message": f"商品「{item['name']}」庫存不足"}), 400
        
        # 修正：確保 category 即使是 None 也能正確處理為字串
        raw_cat = product.get("category", "")
        clean_cat = str(raw_cat).strip() if raw_cat else ""

        item_total = float(item["price"]) * int(item["quantity"])
        full_cart_items.append({
            "product_id": str(product_id),
            "name": product["name"],
            "category": clean_cat,
            "subtotal": item_total
        })
        grand_subtotal += item_total

    # === 2. 促銷邏輯檢查 ===
    all_promos = list(promotions_collection.find())
    best_final_total = grand_subtotal
    applied_promo = None

    for promo in all_promos:
        threshold = float(promo.get("threshold", 0))
        scope_type = promo.get("scope_type", "all")
        scope_val = str(promo.get("scope_value", "")).strip()
        
        eligible_amount = 0
        
        # 強制印出資訊到終端機 (加強版)
        print(f"\n[Promo Check] 正在檢查活動: {promo.get('title')} (目標範疇: {scope_type}, 目標值: {scope_val})", flush=True)

        for item in full_cart_items:
            is_match = False
            if scope_type == "all":
                is_match = True
            elif scope_type == "category" and item["category"] == scope_val:
                is_match = True
            elif scope_type == "product" and item["product_id"] == scope_val:
                is_match = True
            
            if is_match:
                print(f"  -> 匹配成功: {item['name']} (類別: {item['category']})", flush=True)
                eligible_amount += item["subtotal"]

        # 門檻判斷
        if eligible_amount >= threshold and eligible_amount > 0:
            p_type = promo.get("promo_type")
            p_val = float(promo.get("promo_value", 0))
            
            discount_amt = 0
            if p_type == "discount":
                # 只折抵符合範疇的商品金額
                discount_amt = eligible_amount * (1 - p_val)
            elif p_type == "minus":
                discount_amt = p_val

            current_total = grand_subtotal - discount_amt
            
            if current_total < best_final_total:
                best_final_total = max(0, current_total)
                applied_promo = {
                    "title": promo.get("title", "活動"),
                    "discount_value": round(discount_amt, 2)
                }

    final_total = round(best_final_total)
    discount_amount = round(grand_subtotal - final_total, 2)

    # === 3. 執行扣庫存 ===
    for product_id, item in cart.items():
        products_collection.update_one(
            {"_id": ObjectId(product_id)},
            {"$inc": {"stock": -item["quantity"]}}
        )

    # === 4. 存入訂單 ===
    order_id = str(uuid.uuid4())[:8]
    order_data = {
        "order_id": order_id,
        "username": username,
        "email": gmail,
        "subtotal": grand_subtotal,
        "discount_amount": discount_amount,
        "total": final_total,
        "promo_info": applied_promo,
        "pickup_time": pickup_time,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    orders_collection.insert_one(order_data)
    print(f"[Result] 總計: {grand_subtotal}, 折扣: {discount_amount}, 應付: {final_total}\n", flush=True)

    session.pop("cart")
    return jsonify({
        "message": "結帳成功！",
        "final_total": final_total,
        "promo_applied": applied_promo["title"] if applied_promo else "無"
})