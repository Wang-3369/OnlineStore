from flask import Blueprint, request, jsonify, session, send_file
from database.db import db, users_collection
from bson.objectid import ObjectId
from gridfs import GridFS
import io
import uuid
from werkzeug.security import generate_password_hash, check_password_hash

profile_bp = Blueprint("profile", __name__)
fs = GridFS(db)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def login_required(f):
    def wrapper(*args, **kwargs):
        if not session.get("username"):
            return jsonify({"message": "未登入"}), 403
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

# 確保使用者資料完整
def ensure_user_fields(user):
    update_needed = {}
    if "role" not in user:
        update_needed["role"] = "user"
    if "name" not in user:
        update_needed["name"] = user["username"]
    if update_needed:
        db.users.update_one({"_id": user["_id"]}, {"$set": update_needed})
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

    user = db.users.find_one({"username": session["username"]})
    user = ensure_user_fields(user)

    if not user.get("password"):
        return jsonify({"message": "Google 登入帳號無法修改密碼"}), 400

    if not check_password_hash(user["password"], old_password):
        return jsonify({"message": "舊密碼錯誤"}), 400

    hashed = generate_password_hash(new_password)
    db.users.update_one({"username": session["username"]}, {"$set": {"password": hashed}})
    return jsonify({"message": "密碼修改成功"})

# 上傳頭像
@profile_bp.route("/api/profile/avatar", methods=["POST"])
@login_required
def upload_avatar():
    if "avatar" not in request.files:
        return jsonify({"message": "未上傳檔案"}), 400

    file = request.files["avatar"]
    if file.filename == "" or not allowed_file(file.filename):
        return jsonify({"message": "檔名無效或不支援類型"}), 400

    # 存入 GridFS
    image_id = fs.put(file, filename=f"{session['username']}_{uuid.uuid4().hex}.{file.filename.rsplit('.',1)[1]}")

    # 更新使用者資料庫的 avatar 欄位
    db.users.update_one(
        {"username": session["username"]},
        {"$set": {"avatar": str(image_id)}}  # <- 這行更新 avatar
    )

    # 同步更新 session
    session["avatar"] = str(image_id)

    return jsonify({"message": "頭像更新成功", "avatar": str(image_id)})



@profile_bp.route("/api/profile/avatar/<avatar_id>")
@login_required
def get_avatar(avatar_id):
    try:
        file = fs.get(ObjectId(avatar_id))
        # 根據上傳檔案的類型給正確 mime
        mimetype = "image/jpeg"
        if file.filename.lower().endswith(".png"):
            mimetype = "image/png"
        elif file.filename.lower().endswith(".gif"):
            mimetype = "image/gif"
        return send_file(io.BytesIO(file.read()), mimetype=mimetype, download_name=file.filename)
    except:
        return jsonify({"error": "圖片不存在"}), 404
    
@profile_bp.route("/api/profile/delete_avatar", methods=["POST"])
@login_required
def delete_avatar():
    username = session["username"]
    user = users_collection.find_one({"username": username})

    if user.get("avatar"):
        # 如果 avatar 是 ObjectId 存在 GridFS，刪掉
        try:
            fs.delete(ObjectId(user["avatar"]))
        except:
            pass

        # 更新資料庫
        users_collection.update_one({"username": username}, {"$set": {"avatar": None}})
        # 更新 session
        session["avatar"] = None

        return jsonify({"message": "頭像已刪除"})
    else:
        return jsonify({"message": "沒有自訂頭像可刪除"}), 400



