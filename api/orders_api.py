from flask import Blueprint, session, jsonify, request
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
        orders.append(order)

    return jsonify({"orders": orders})


# 使用者送出新訂單
@orders_bp.route("/api/orders", methods=["POST"])
def create_order():
    username = session.get("username")
    if not username:
        return jsonify({"message": "請先登入"}), 403

    data = request.get_json(force=True)
    if not data or "products" not in data:
        return jsonify({"message": "缺少訂單資料"}), 400

    new_order = {
        "username": username,
        "products": data["products"],  # {商品名稱: 數量}
        "total_price": data.get("total_price", 0),
        "status": "pending"
    }

    # 寫入 MongoDB
    result = orders_collection.insert_one(new_order)
    new_order["_id"] = str(result.inserted_id)

    # 通知管理員有新訂單
    try:
        from app import notify_admin_new_order
        notify_admin_new_order({
            "username": username,
            "order_id": new_order["_id"],
            "products": new_order["products"],
            "total_price": new_order["total_price"],
            "message": f"{username} 下了一張新訂單！"
        })
    except Exception as e:
        print("通知管理員失敗：", e)

    return jsonify({
        "message": "訂單已建立！",
        "order": new_order
    }), 201