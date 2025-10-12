from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from database.db import users_collection
from datetime import datetime

auth_bp = Blueprint("auth", __name__)

# 註冊
@auth_bp.route("/api/register", methods=["POST"])
def register():
    data = request.json
    username = data["username"]
    password = data["password"]

    # 檢查帳號是否存在
    if users_collection.find_one({"username": username}):
        return jsonify({"message": "帳號已存在"}), 400

    hashed_password = generate_password_hash(password)

    users_collection.insert_one({
        "username": username,
        "password": hashed_password,
        "role": "user",  # 新註冊預設一般使用者
        "created_at": datetime.utcnow()
    })

    return jsonify({"message": "註冊成功"})

# 登入
@auth_bp.route("/api/login", methods=["POST"])
def login():
    data = request.json
    username = data["username"]
    password = data["password"]

    user = users_collection.find_one({"username": username})
    if not user or not check_password_hash(user["password"], password):
        return jsonify({"message": "帳號或密碼錯誤"}), 401

    session["username"] = username
    session["role"] = user.get("role", "user")
    return jsonify({"message": "登入成功", "role": user.get("role", "user")})

# 登出
@auth_bp.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "已登出"})
