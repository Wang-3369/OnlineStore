import os
from flask import Flask, render_template, session, redirect
# 導入各模組的 Blueprint
from api.product_api import product_bp
from api.auth_api import auth_bp
from api.admin_api import admin_bp
from api.orders_api import orders_bp
from api.cart_api import cart_bp
from api.profile_api import profile_bp
from api.description_api import description_bp
from api.promotions_api import promotion_bp
from api.stats_api import stats_api
from api.review_api import review_api
from api.favorites_api import favorites_bp
# 導入資料庫 Collection
from database.db import products_collection, orders_collection, product_reviews_collection
from dotenv import load_dotenv

app = Flask(__name__)
# 設定 session 用的 secret key，從 .env 讀取，若沒有則用預設
app.secret_key = os.getenv("SECRET_KEY", "mydefaultsecret")

# 註冊各個 API blueprint
app.register_blueprint(auth_bp)
app.register_blueprint(product_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(cart_bp)
app.register_blueprint(orders_bp)
app.register_blueprint(profile_bp)
app.register_blueprint(description_bp)
app.register_blueprint(promotion_bp)
app.register_blueprint(stats_api)
app.register_blueprint(review_api)
app.register_blueprint(favorites_bp)

# ------------------------------
# 路由設定
# ------------------------------

@app.route('/')
def index():
    """
    首頁，顯示所有商品
    """
    products = []
    # 從 MongoDB 讀取所有商品資料
    for p in products_collection.find():
        products.append({
            "id": str(p["_id"]),  # Mongo ObjectId 轉成字串
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

# 登出，清空 session
@app.route("/logout")
def logout_page():
    session.clear()
    return redirect("/")

# 使用者訂單頁面
@app.route("/orders")
def orders_page():
    if not session.get("username"):
        return "請先登入", 403

    username = session.get("username")
    orders_cursor = orders_collection.find({"username": username})
    orders = []

    for order in orders_cursor:
        order["_id"] = str(order["_id"])
        order["products"] = dict(order["products"])

        # 查詢使用者是否已對此訂單評論過
        review = product_reviews_collection.find_one({"username": username, "order_id": order["order_id"]})
        if review:
            order["review"] = {
                "content": review["content"],
                "rating": review["rating"]
            }
        else:
            order["review"] = None

        orders.append(order)

    return render_template("orders.html", orders=orders)

# 購物車頁面
@app.route("/cart")
def cart_page():
    return render_template("cart.html")

# 管理員商品修改頁面
@app.route("/admin")
def admin_page():
    if session.get("role") not in ["admin", "sub-admin"]:
        return redirect("/")
    return render_template("admin.html")

# 管理員使用者管理頁面
@app.route("/admin/user")
def admin_user_page():
    if session.get("role") != "admin":
        return redirect("/")
    from database.db import users_collection
    users = list(users_collection.find())
    return render_template("admin_users.html", users=users)

# 使用者自我管理頁面
@app.route("/profile")
def profile_page():
    if not session.get("username"):
        return redirect("/login")
    
    from database.db import users_collection
    user = users_collection.find_one({"username": session["username"]})
    
    return render_template("profile.html", user=user)

# 管理員訂單管理頁面
@app.route("/admin/orders")
def admin_orders_page():
    if session.get("role") not in ["admin", "sub-admin"]:
        return redirect("/")
    return render_template("admin_orders.html")

# 商品詳情頁面
@app.route("/description/<product_id>")
def description_page(product_id):
    return render_template("description.html")

# 管理員促銷管理頁面
@app.route("/admin/promotions")
def admin_promotions_page():
    if session.get("role") not in ["admin", "sub-admin"]:
        return "沒有權限", 403
    return render_template("promotions.html")

# 管理員統計頁面
@app.route("/admin/stats")
def stats_page():
    return render_template("stats.html")

# 評論區頁面
@app.route("/reviews")
def product_reviews_page():
    if not session.get("username"):
        return redirect("/login")
    return render_template("product_reviews.html")

#收藏頁面
@app.route("/favorites")
def favorites_page():
    if not session.get("username"):
        return redirect("/login")
    return render_template("favorites.html")

# 啟動 Flask
if __name__ == '__main__':
    app.run(debug=True)
