from flask import Blueprint, request, jsonify, session
from database.db import users_collection
from bson.objectid import ObjectId

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
