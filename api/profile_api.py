from flask import Blueprint, request, jsonify, session, send_file, make_response
from database.db import db, users_collection
from bson.objectid import ObjectId
from gridfs import GridFS
import io
import os
import uuid
from utils.image import compress_image
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
# --- upload_avatar 內部修正 ---
@profile_bp.route("/api/profile/avatar", methods=["POST"])
@login_required
def upload_avatar():
    if "avatar" not in request.files:
        return jsonify({"message": "未上傳檔案"}), 400

    file = request.files["avatar"]
    if file.filename == "" or not allowed_file(file.filename):
        return jsonify({"message": "檔名無效或不支援類型"}), 400

    # 1. 執行壓縮 (頭像 300x300 即可)
    compressed_io = compress_image(file, max_size=(300, 300), quality=80)

    # 2. 存入 GridFS (注意這裡要傳 compressed_io 而不是原始的 file)
    image_id = fs.put(
        compressed_io, 
        filename=f"{session['username']}_avatar.jpg", 
        content_type="image/jpeg"
    )

    # 3. 更新資料庫
    db.users.update_one(
        {"username": session["username"]},
        {"$set": {"avatar": str(image_id)}}
    )
    session["avatar"] = str(image_id)

    return jsonify({"message": "頭像更新成功", "avatar": str(image_id)})



@profile_bp.route("/api/profile/avatar/<avatar_id>")
@login_required
def get_avatar(avatar_id):
    try:
        file = fs.get(ObjectId(avatar_id))
        
        # 建立回應物件
        response = make_response(file.read())
        response.headers['Content-Type'] = 'image/jpeg'
        
        # 套用環境變數中的快取設定
        cache_timeout = os.getenv("IMAGE_CACHE_TIMEOUT", "86400")
        response.headers['Cache-Control'] = f'public, max-age={cache_timeout}'
        
        return response
    except Exception as e:
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


# 更新聯絡 Email
@profile_bp.route("/api/profile/change_email", methods=["POST"])
@login_required
def change_email():
    data = request.json
    new_email = data.get("email")

    # 基本驗證
    if not new_email or "@" not in new_email:
        return jsonify({"message": "請提供有效的 Email 地址"}), 400

    # 更新資料庫
    # 您在檔案開頭有定義 users_collection = db.users
    result = users_collection.update_one(
        {"username": session["username"]},
        {"$set": {"email": new_email}}
    )

    if result.modified_count > 0 or result.matched_count > 0:
        # 同步更新 session (如果其他地方有用到 session 中的 email)
        session["email"] = new_email
        return jsonify({"message": "Email 更新成功"})
    else:
        return jsonify({"message": "資料更新失敗"}), 400
    
@profile_bp.route("/api/profile/info", methods=["GET"])
@login_required
def get_profile_info():
    user = users_collection.find_one({"username": session["username"]})
    if user:
        return jsonify({
            "username": user.get("username"),
            "email": user.get("email") # 回傳現有的 Email
        })
    return jsonify({"message": "找不到使用者"}), 404
