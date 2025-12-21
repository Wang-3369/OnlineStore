import os
from flask import Blueprint, request, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from database.db import users_collection
from datetime import datetime
from dotenv import load_dotenv
from authlib.integrations.flask_client import OAuth

load_dotenv()

auth_bp = Blueprint("auth", __name__)

# === 帳號密碼登入功能 ===
import re  # 匯入正則表達式模組
from datetime import datetime, timedelta, timezone

# 定義台灣時區（如果你之前已經定義過，可以共用）
tw_tz = timezone(timedelta(hours=8))

@auth_bp.route("/api/register", methods=["POST"])
def register():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    # 1. 基本欄位檢查
    if not username or not password:
        return jsonify({"message": "帳號與密碼為必填"}), 400

    # 2. 密碼複雜度檢測 (後端防線)
    # 規則：至少 8 位，包含大小寫、數字、特殊符號
    pwd_pattern = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$"
    if not re.match(pwd_pattern, password):
        return jsonify({
            "message": "密碼強度不足：需至少 8 個字元，且包含大小寫英文字母、數字及特殊符號 (@$!%*?&)"
        }), 400

    # 3. 檢查帳號是否重複
    if users_collection.find_one({"username": username}):
        return jsonify({"message": "帳號已存在"}), 400

    # 4. 雜湊密碼並存入資料庫
    hashed_password = generate_password_hash(password)
    users_collection.insert_one({
        "username": username,
        "password": hashed_password,
        "role": "user",
        "avatar": None,
        "google_avatar": None,
        # 建議改用台灣時間存入，或一致使用 datetime.now(timezone.utc)
        "created_at": datetime.now(tw_tz) 
    })
    return jsonify({"message": "註冊成功"})

@auth_bp.route("/api/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    user = users_collection.find_one({"username": username})
    if not user or not check_password_hash(user.get("password", ""), password):
        return jsonify({"message": "帳號或密碼錯誤"}), 401

     # 設定 session
    session["username"] = username
    session["role"] = user.get("role", "user")
    session["avatar"] = user.get("avatar")  # 自訂頭像
    session["google_avatar"] = user.get("google_avatar")  # Google登入帳號可能沒有

    return jsonify({"message": "登入成功", "role": user.get("role", "user")})

@auth_bp.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "已登出"})


# === Google 登入功能 (Authlib + OpenID Connect) ===
oauth = OAuth()
google = oauth.register(
    name='google',
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
    # 加上 api_base_url 才能正確解析相對 URL
    api_base_url='https://openidconnect.googleapis.com/v1/'
)

@auth_bp.record_once
def register_oauth(state):
    oauth.init_app(state.app)

# Google 登入入口
@auth_bp.route("/login/google")
def login_google():
    redirect_uri = url_for('auth.google_callback', _external=True)
    return google.authorize_redirect(redirect_uri)

# Google 登入回調
@auth_bp.route("/login/callback")
def google_callback():
    token = google.authorize_access_token()
    resp = google.get('userinfo', token=token)
    user_info = resp.json()

    email = user_info.get("email")
    name = user_info.get("name")
    google_avatar = user_info.get("picture")

    user = users_collection.find_one({"username": email})
    if not user:
        user_id = users_collection.insert_one({
            "username": email,
            "password": None,
            "role": "user",
            "name": name,
            "avatar": None,
            "google_avatar": google_avatar,
            "created_at": datetime.now(tw_tz)
        }).inserted_id
        user = users_collection.find_one({"_id": user_id})
    else:
        users_collection.update_one(
            {"username": email},
            {"$set": {"google_avatar": google_avatar}}
        )
        user = users_collection.find_one({"username": email})

    # 設定 session
    session["username"] = email
    session["role"] = user.get("role", "user")
    session["avatar"] = user.get("avatar")  # 自訂頭像優先
    session["google_avatar"] = user.get("google_avatar")  # Google頭像

    return redirect("/")


