from flask import Blueprint, session, jsonify
from database.db import orders_collection, product_reviews_collection
from bson.objectid import ObjectId

orders_bp = Blueprint("orders", __name__)

# 取得使用者訂單
@orders_bp.route("/api/orders", methods=["GET"])
def get_orders():
    username = session.get("username")
    if not username:
        return jsonify({"message": "尚未登入"}), 403

    # 使用 .sort("created_at", -1) 讓最新訂單排在最上面
    orders_cursor = orders_collection.find({"username": username}).sort("created_at", -1)
    orders = []

    for order in orders_cursor:
        # 1. 處理 MongoDB ID
        order["_id"] = str(order["_id"])
        
        # 2. 處理時間格式
        if "created_at" in order:
            order["created_at"] = order["created_at"].isoformat()

        # 3. ✅ 安全檢查：處理 products 欄位，預防 KeyError
        # 使用 .get() 並給予空字典作為預設值
        raw_products = order.get("products")
        order["products"] = dict(raw_products) if raw_products else {}

        # 4. 取得該訂單對應的評論（含管理者回覆）
        review = product_reviews_collection.find_one({
            "username": username, 
            "order_id": order.get("order_id")
        })
        
        if review:
            order["review"] = {
                "content": review.get("content", ""),
                "rating": review.get("rating", 0),
                "reply": review.get("reply") # 如果管理者有回覆就帶出
            }
        else:
            order["review"] = None

        orders.append(order)

    return jsonify({"orders": orders})