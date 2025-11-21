import os
from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from database.db import users_collection
from datetime import datetime
import uuid

profile_bp = Blueprint("profile", __name__)

# 可接受的頭像副檔名
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}
UPLOAD_FOLDER = os.path.join(os.getcwd(), "static", "uploads", "avatars")

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

# 驗證登入 decorator
def login_required(f):
    def wrapper(*args, **kwargs):
        if not session.get("username"):
            return jsonify({"message": "未登入"}), 403
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

# 確保使用者文件欄位完整
def ensure_user_fields(user):
    update_needed = {}
    if "role" not in user:
        update_needed["role"] = "user"
    if "avatar" not in user:
        update_needed["avatar"] = "/static/images/user.png"
    if "name" not in user:
        update_needed["name"] = user["username"]
    if update_needed:
        users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": update_needed}
        )
        user.update(update_needed)
    return user

# 修改密碼
@profile_bp.route("/api/profile/change_password", methods=["POST"])
@login_required
def change_password():
    data = request.json
    old_password = data.get("old_password")
    new_password = data.get("new_password")

    if not new_password or len(new_password) < 6:
        return jsonify({"message": "新密碼至少 6 個字元"}), 400

    user = users_collection.find_one({"username": session["username"]})
    user = ensure_user_fields(user)

    # 若使用 Google 登入且沒有密碼
    if not user.get("password"):
        return jsonify({"message": "Google 登入帳號無法修改密碼"}), 400

    if not check_password_hash(user["password"], old_password):
        return jsonify({"message": "舊密碼錯誤"}), 400

    hashed = generate_password_hash(new_password)
    users_collection.update_one(
        {"username": session["username"]},
        {"$set": {"password": hashed}}
    )
    return jsonify({"message": "密碼修改成功"})

# 上傳頭像
@profile_bp.route("/api/profile/avatar", methods=["POST"])
@login_required
def upload_avatar():
    if "avatar" not in request.files:
        return jsonify({"message": "未上傳檔案"}), 400

    file = request.files["avatar"]
    if file.filename == "":
        return jsonify({"message": "檔名無效"}), 400
    if file and allowed_file(file.filename):
        ext = file.filename.rsplit(".", 1)[1].lower()
        # 使用 username + uuid 避免檔名衝突
        filename = f"{session['username']}_{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        file.save(filepath)

        avatar_url = f"/static/uploads/avatars/{filename}"
        users_collection.update_one(
            {"username": session["username"]},
            {"$set": {"avatar": avatar_url}}
        )
        session["avatar"] = avatar_url
        return jsonify({"message": "頭像更新成功", "avatar": avatar_url})
    else:
        return jsonify({"message": "不支援的檔案類型"}), 400
