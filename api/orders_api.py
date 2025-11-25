from flask import Blueprint, session, jsonify
from database.db import orders_collection,product_reviews_collection  # 匯入評論 collection

orders_bp = Blueprint("orders", __name__)

# 取得使用者訂單
@orders_bp.route("/api/orders", methods=["GET"])
def get_orders():
    username = session.get("username")
    if not username:
        return jsonify({"message": "尚未登入"}), 403

    orders_cursor = orders_collection.find({"username": username})
    orders = []

    for order in orders_cursor:
        order["_id"] = str(order["_id"])
        # 將 created_at 轉成 ISO 字串
        if "created_at" in order:
            order["created_at"] = order["created_at"].isoformat()

        # ✅ 取得該訂單對應的評論（含管理者回覆）
        review = product_reviews_collection.find_one({"username": username, "order_id": order["order_id"]})
        if review:
            order["review"] = {
                "content": review["content"],
                "rating": review["rating"],
                "reply": review.get("reply")  # 如果管理者有回覆就帶出
            }
        else:
            order["review"] = None

        orders.append(order)

    return jsonify({"orders": orders})
