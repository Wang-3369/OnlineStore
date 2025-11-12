import os
from flask import Flask, render_template, session, redirect
from api.product_api import product_bp
from api.auth_api import auth_bp
from api.admin_api import admin_bp
from api.orders_api import orders_bp
from api.cart_api import cart_bp
from database.db import products_collection  # 從 db.py 匯入 collection
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "mydefaultsecret")

# 載入 API
app.register_blueprint(auth_bp)
app.register_blueprint(product_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(cart_bp)
app.register_blueprint(orders_bp)

@app.route('/')
def index():
    products = []
    for p in products_collection.find():
        products.append({
            "id": str(p["_id"]),
            "name": p["name"],
            "price": p["price"]
        })
    return render_template("index.html", products=products)

# 登入頁面           
@app.route("/login")
def login_page():
    return render_template("login.html")

# 註冊頁面
@app.route("/register")
def register_page():
    return render_template("register.html")

# 登出
@app.route("/logout")
def logout_page():
    session.clear()
    return redirect("/")

# 訂單頁面
@app.route("/orders")
def orders_page():
    if not session.get("username"):
        return "請先登入", 403

    from database.db import orders_collection
    username = session.get("username")
    orders_cursor = orders_collection.find({"username": username})
    orders = []
    for order in orders_cursor:
        order["_id"] = str(order["_id"])
        # 確保 products 是 dict
        order["products"] = dict(order["products"])
        orders.append(order)
    return render_template("orders.html", orders=orders)

# 購物車頁面
@app.route("/cart")
def cart_page():
    return render_template("cart.html")

# 商品修改頁面
@app.route("/admin")
def admin_page():
    if session.get("role") not in ["admin", "sub-admin"]:
        return redirect("/")
    return render_template("admin.html")

# 人員管理頁面
@app.route("/admin/user")
def admin_user_page():
    if session.get("role") != "admin":
        return redirect("/")
    from database.db import users_collection
    users = list(users_collection.find())
    return render_template("admin_users.html", users=users)



#以下為「新增的 SocketIO 即時通知功能」
from flask_socketio import SocketIO, join_room

# 初始化 SocketIO
socketio = SocketIO(app, cors_allowed_origins="*")

# 管理者加入通知房間
@socketio.on("join_admin")
def handle_join_admin(data):
    username = data.get("username")
    join_room("admin_room")
    print(f"{username} 已加入 admin_room")

# 當有新訂單時通知管理者
def notify_admin_new_order(order_data):
    socketio.emit("new_order", order_data, room="admin_room")
    print("已通知 admin_room 有新訂單")

# 讓其他模組能呼叫通知功能
app.notify_admin_new_order = notify_admin_new_order



# 啟動伺服器（改成使用 socketio.run）
if __name__ == '__main__':
    socketio.run(app, debug=True)