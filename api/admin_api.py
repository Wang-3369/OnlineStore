from flask import Blueprint, request, jsonify, session, current_app
from database.db import users_collection, orders_collection,products_collection
from bson.objectid import ObjectId
from flask_mail import Message

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
    from app import mail  # 重要：從主程式導入 mail 實例
    
    data = request.json
    order_id = data.get("order_id")
    new_status = data.get("status")

    if not order_id or not new_status:
        return jsonify({"message": "參數錯誤"}), 400

    # 取得訂單詳情
    order = orders_collection.find_one({"order_id": order_id})
    if not order:
        return jsonify({"message": "找不到訂單"}), 404

    # 1. 拒絕訂單回補庫存
    if new_status == "rejected" and order.get("status") != "rejected":
        for pid, item in order.get("products", {}).items():
            products_collection.update_one(
                {"_id": ObjectId(pid)},
                {"$inc": {"stock": item["quantity"]}}
            )

    # 2. 更新資料庫中的訂單狀態
    result = orders_collection.update_one(
        {"order_id": order_id},
        {"$set": {"status": new_status}}
    )

    if result.modified_count > 0:
        # 3. 如果「接受訂單」，發送 Email 給顧客
        if new_status == "accepted":
            send_status_email(mail, order, "訂單已接受", "您的訂單已被商家接受，正在製作中！")
        
        # (選填) 如果想在「完成」時也發信，可以加這段：
        elif new_status == "completed":
            send_status_email(mail, order, "餐點已完成", "您的餐點已準備好，請儘速前往取餐。")

        return jsonify({"message": f"訂單狀態已更新為 {new_status}"})
    else:
        return jsonify({"message": "訂單狀態更新失敗或未變動"}), 400

# 輔助函式：發送郵件
def send_status_email(mail, order, subject_title, status_text):
    try:
        # 從訂單中獲取顧客 Email (假設您的訂單 document 有存 email 欄位)
        # 如果訂單沒存，可能要根據 order['username'] 去 users_collection 查
        customer_email = order.get("email")
        
        if not customer_email:
            # 如果訂單沒存 Email，去使用者表查一次
            user = users_collection.find_one({"username": order.get("username")})
            customer_email = user.get("email") if user else None

        if customer_email:
            msg = Message(
                subject=f"【OnlineStoreOcean】{subject_title} (單號: {order['order_id']})",
                recipients=[customer_email],
                body=f"親愛的 {order.get('username')} 您好：\n\n{status_text}\n\n"
                     f"訂單單號：{order['order_id']}\n"
                     f"預計取餐時間：{order.get('pickup_time', '未指定')}\n"
                     f"總金額：${order.get('total')}\n\n"
                     f"感謝您的支持！"
            )
            mail.send(msg)
            print(f"成功發送郵件至 {customer_email}")
    except Exception as e:
        print(f"郵件發送錯誤: {e}")