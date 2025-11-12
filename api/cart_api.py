from flask import Blueprint, session, request, jsonify
from database.db import products_collection  # 商品 collection
from database.db import users_collection     # 帳號 collection
from bson.objectid import ObjectId
import uuid

cart_bp = Blueprint("cart", __name__)

# 加入購物車
@cart_bp.route("/api/cart/add", methods=["POST"])
def add_to_cart():
    data = request.json
    product_id = str(data.get("product_id"))
    quantity = int(data.get("quantity", 1))

    if not product_id:
        return jsonify({"message": "缺少 product_id"}), 400

    try:
        product = products_collection.find_one({"_id": ObjectId(product_id)})
    except:
        return jsonify({"message": "無效的 product_id"}), 400

    if not product:
        return jsonify({"message": "商品不存在"}), 404

    cart = session.get("cart", {})
    if product_id in cart:
        cart[product_id]["quantity"] += quantity
    else:
        cart[product_id] = {
            "name": product["name"],
            "price": product["price"],
            "quantity": quantity
        }
    session["cart"] = cart
    return jsonify({"message": f"{product['name']} 已加入購物車", "cart": cart})

# 更新購物車數量
@cart_bp.route("/api/cart/update", methods=["POST"])
def update_cart():
    data = request.json
    product_id = str(data.get("product_id"))
    quantity = int(data.get("quantity", 1))
    cart = session.get("cart", {})

    if product_id in cart:
        if quantity <= 0:
            cart.pop(product_id)
        else:
            cart[product_id]["quantity"] = quantity
        session["cart"] = cart
    return jsonify({"cart": cart})

# 刪除購物車商品
@cart_bp.route("/api/cart/remove", methods=["POST"])
def remove_cart_item():
    product_id = str(request.json.get("product_id"))
    cart = session.get("cart", {})
    if product_id in cart:
        cart.pop(product_id)
        session["cart"] = cart
    return jsonify({"cart": cart})

# 取得購物車內容
@cart_bp.route("/api/cart", methods=["GET"])
def get_cart():
    cart = session.get("cart", {})
    return jsonify({"cart": cart})

from database.db import orders_collection  # 新增：訂單 collection

# 結帳，產生訂單編號並存入 MongoDB
@cart_bp.route("/api/cart/checkout", methods=["POST"])
def checkout():

    # 取得 socketio
    from flask import current_app
    socketio = current_app.extensions.get('socketio')

    cart = session.get("cart", {})
    username = session.get("username")

    if not cart:
        return jsonify({"message": "購物車為空"}), 400
    if not username:
        return jsonify({"message": "尚未登入"}), 403

    # 計算總價
    total = sum(float(item["price"]) * int(item["quantity"]) for item in cart.values())
    order_id = str(uuid.uuid4())[:8]

    # 改名 items -> products
    order_data = {
        "order_id": order_id,
        "username": username,
        "products": cart,  # 改欄位名稱
        "total": total
    }
    orders_collection.insert_one(order_data)

    # 清空購物車
    session.pop("cart")

    # ===== 通知管理者 =====
    admins = users_collection.find({"role": {"$in": ["admin", "sub-admin"]}})
    for admin in admins:
        # 假設用 SocketIO room 存管理者 _id
        socketio.emit("new_order", {
            "order_id": order_id,
            "username": username,
            "products": cart,
            "total": total
        }, 
        room=str(admin["username"]),
        namespace='/admin'
        )
        print("send new_order to "+admin["username"]) 

    return jsonify({
        "message": f"結帳成功！訂單編號：{order_id}",
        "order_id": order_id,
        "total": total
    })

