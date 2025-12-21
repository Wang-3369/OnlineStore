from flask import Blueprint, request, jsonify, session
from database.db import users_collection, orders_collection, products_collection
from bson.objectid import ObjectId
import json
from flask_mail import Message

admin_bp = Blueprint("admin", __name__)

# --- 權限檢查 Decorator ---
def admin_required(f):
    def wrapper(*args, **kwargs):
        if session.get("role") not in ["admin", "sub-admin"]:
            return jsonify({"message": "無權限"}), 403
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

# --- 輔助函式：發送郵件 ---
def send_status_email(mail, order, subject_title, status_text):
    try:
        customer_email = order.get("email")
        if not customer_email:
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

# --- 使用者管理 ---
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

@admin_bp.route("/api/admin/promote", methods=["POST"])
@admin_required
def promote_user():
    user_id = request.json.get("user_id")
    users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"role": "sub-admin"}})
    return jsonify({"message": "已升級為次管理者"})

@admin_bp.route("/api/admin/demote", methods=["POST"])
@admin_required
def demote_user():
    user_id = request.json.get("user_id")
    users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"role": "user"}})
    return jsonify({"message": "已降級為一般使用者"})

@admin_bp.route("/api/admin/delete", methods=["POST"])
@admin_required
def delete_user():
    user_id = request.json.get("user_id")
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if user and user.get("role") == "admin":
        return jsonify({"message": "管理者帳號不可刪除"}), 403
    users_collection.delete_one({"_id": ObjectId(user_id)})
    return jsonify({"message": "使用者已被刪除"})

# --- 訂單管理 ---
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

@admin_bp.route("/api/admin/order/status", methods=["POST"])
@admin_required
def update_order_status():
    # 從 app.py 導入共用實例
    from app import mail, pusher_client  
    
    data = request.json
    order_id = data.get("order_id")
    new_status = data.get("status")

    if not order_id or not new_status:
        return jsonify({"message": "參數錯誤"}), 400

    order = orders_collection.find_one({"order_id": order_id})
    if not order:
        return jsonify({"message": "找不到訂單"}), 404

    # 狀態對應中文 (用於通知顯示)
    status_map = {
        "pending": "待處理",
        "accepted": "製作中",
        "completed": "請取餐",
        "rejected": "已拒絕",
        "cancelled": "已取消"
    }
    chinese_status = status_map.get(new_status, new_status)

    # 1. 拒絕訂單回補庫存
    if new_status == "rejected" and order.get("status") != "rejected":
        for pid, item in order.get("products", {}).items():
            products_collection.update_one(
                {"_id": ObjectId(pid)},
                {"$inc": {"stock": item["quantity"]}}
            )

    # 2. 更新資料庫
    result = orders_collection.update_one(
        {"order_id": order_id},
        {"$set": {"status": new_status}}
    )
    # admin_bp.py 裡面的 update_order_status 函式
    if result.modified_count > 0:
        # ... 原有的通知使用者代碼 ...
        
        # 新增：通知所有管理員界面刷新
        pusher_client.trigger('admin-channel', 'order-status-updated', {
            "order_id": order_id,
            "status": new_status
    })
    # 3. 如果成功更新，觸發 Pusher 即時通知與 Email
    # --- 整理後的更新邏輯 ---
    if result.modified_count > 0:
        target_username = order.get("username")
        
        # --- A. 通知「管理者」介面自動刷新 (所有管理員分頁同步) ---
        try:
            pusher_client.trigger('admin-channel', 'order-status-updated', {
                "order_id": order_id,
                "status": new_status
            })
        except Exception as e:
            print(f"Pusher Admin 通知失敗: {e}")

        # --- B. 通知「該顧客」餐點進度 ---
        try:
            pusher_client.trigger(f'user-{target_username}', 'order-update', {
                "order_id": order_id,
                "status": chinese_status
            })
        except Exception as pe:
            print(f"Pusher User 通知失敗: {pe}")

        # --- C. Email 通知 ---
        if new_status == "accepted":
            send_status_email(mail, order, "訂單已接受", "您的訂單正在製作中！")
        elif new_status == "completed":
            send_status_email(mail, order, "餐點已完成", "請儘速前往取餐。")

        return jsonify({"message": f"訂單狀態已更新為 {chinese_status}"})
    
    return jsonify({"message": "狀態未變動"}), 400