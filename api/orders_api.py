from flask import Blueprint, session, jsonify
from database.db import orders_collection

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
        # 將 created_at 轉成 ISO 字串，避免前端直接顯示 MongoDB datetime 物件
        if "created_at" in order:
            order["created_at"] = order["created_at"].isoformat()
        orders.append(order)

    return jsonify({"orders": orders})
