import os
from flask import Flask, render_template, session, redirect
from api.product_api import product_bp
from api.auth_api import auth_bp
from api.admin_api import admin_bp
from api.orders_api import orders_bp
from api.cart_api import cart_bp
from database.db import products_collection  # 從 db.py 匯入 collection
from dotenv import load_dotenv

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
            "id": str(p["_id"]),  # 轉成字串
            "name": p["name"],
            "price": p["price"]
        })
    return render_template("index.html", products=products)

@app.route("/login")
def login_page():
    return render_template("login.html")

@app.route("/register")
def register_page():
    return render_template("register.html")

@app.route("/logout")
def logout_page():
    session.clear()
    return redirect("/")

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

@app.route("/admin")
def admin_page():
    if session.get("role") not in ["admin", "sub-admin"]:
        return redirect("/")
    return render_template("admin.html")

@app.route("/admin/user")
def admin_user_page():
    if session.get("role") != "admin":
        return redirect("/")
    from database.db import users_collection
    users = list(users_collection.find())
    return render_template("admin_users.html", users=users)


if __name__ == '__main__':
    app.run(debug=True)
