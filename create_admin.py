from werkzeug.security import generate_password_hash
from database.db import users_collection
from datetime import datetime

# 建立管理者帳號
admin = {
    "username": "01257032",
    "password": generate_password_hash("01257032"),
    "role": "admin",
    "created_at": datetime.utcnow()
}

# 插入資料，如果已存在就不插入
if not users_collection.find_one({"username": admin["username"]}):
    users_collection.insert_one(admin)
    print("管理者帳號已建立")
else:
    print("管理者帳號已存在")
