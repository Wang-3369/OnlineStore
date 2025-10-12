import os
from flask import Flask, render_template, session, redirect
from api.product_api import product_bp
from api.auth_api import auth_bp
from api.admin_api import admin_bp
from api.cart_api import cart_bp
from database.db import products_collection  # 從 db.py 匯入 collection

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")

# 載入 API
app.register_blueprint(auth_bp)
app.register_blueprint(product_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(cart_bp)

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
