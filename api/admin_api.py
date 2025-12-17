from flask import Blueprint, request, jsonify, session
from database.db import users_collection, orders_collection,products_collection
from bson.objectid import ObjectId
from utils.sse import announcer, format_sse

admin_bp = Blueprint("admin", __name__)

# 權限檢查 decorator
def admin_required(f):
    def wrapper(*args, **kwargs):
        if session.get("role") != "admin":
            return jsonify({"message": "無權限"}), 403
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

# 列出所有使用者
@admin_bp.route("/api/admin/users", methods=["GET"])
@admin_required
def get_users():
    users = []
    for u in users_collection.find():
        users.append({
            "id": str(u["_id"]),
            "username": u["username"],
            "role": u.get("role", "user")
        })
    return jsonify(users)

# 提升使用者為次管理者
@admin_bp.route("/api/admin/promote", methods=["POST"])
@admin_required
def promote_user():
    user_id = request.json.get("user_id")
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"message": "使用者不存在"}), 404
    if user.get("role") != "user":
        return jsonify({"message": "無法升級該使用者"}), 400

    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"role": "sub-admin"}}
    )
    return jsonify({"message": f"使用者 {user['username']} 已升級為次管理者"})

# 降級次管理者為一般使用者
@admin_bp.route("/api/admin/demote", methods=["POST"])
@admin_required
def demote_user():
    user_id = request.json.get("user_id")
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"message": "使用者不存在"}), 404
    if user.get("role") != "sub-admin":
        return jsonify({"message": "該使用者不是次管理者"}), 400

    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"role": "user"}}
    )
    return jsonify({"message": f"使用者 {user['username']} 已降級為一般使用者"})

# 刪除帳號
@admin_bp.route("/api/admin/delete", methods=["POST"])
@admin_required
def delete_user():
    user_id = request.json.get("user_id")
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"message": "使用者不存在"}), 404
    if user.get("role") == "admin":
        return jsonify({"message": "管理者帳號不可刪除"}), 403

    users_collection.delete_one({"_id": ObjectId(user_id)})
    return jsonify({"message": f"使用者 {user['username']} 已被刪除"})

# 訂單API部分

# 取得所有訂單
@admin_bp.route("/api/admin/orders", methods=["GET"])
@admin_required
def get_all_orders():
    orders_cursor = orders_collection.find().sort("created_at", -1)
    orders = []
    for order in orders_cursor:
        order["_id"] = str(order["_id"])
        if "created_at" in order:
            order["created_at"] = order["created_at"].isoformat()
        orders.append(order)
    return jsonify(orders)

# 修改訂單狀態 (接受/拒絕/完成)
@admin_bp.route("/api/admin/order/status", methods=["POST"])
@admin_required
def update_order_status():
    data = request.json
    order_id = data.get("order_id")
    new_status = data.get("status")

    if not order_id or not new_status:
        return jsonify({"message": "參數錯誤"}), 400

    # 取得訂單
    order = orders_collection.find_one({"order_id": order_id})
    if not order:
        return jsonify({"message": "找不到訂單"}), 404

    # 拒絕訂單回補庫存 (只回補非已拒絕訂單)
    if new_status == "rejected" and order.get("status") != "rejected":
        for pid, item in order.get("products", {}).items():
            products_collection.update_one(
                {"_id": ObjectId(pid)},  # <-- 改這裡
                {"$inc": {"stock": item["quantity"]}}
            )

    orders_collection.update_one(
        {"order_id": order_id},
        {"$set": {"status": new_status}}
    )

    # 更新訂單狀態
    username = order["username"] # 取得訂單歸屬者
    
    msg_payload = json.dumps({
        "order_id": order_id,
        "status": new_status,
        "username": username  # 前端可判斷是否為自己的訂單
    })
    announcer.announce(format_sse(data=msg_payload, event="order_update"))
    
    return jsonify({"message": "更新成功"})
