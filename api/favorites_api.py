from flask import Blueprint, request, session, jsonify
from bson import ObjectId
from database.db import users_collection, products_collection

favorites_bp = Blueprint("favorites_bp", __name__)

# ------------------------
# 取得使用者收藏列表
# ------------------------
@favorites_bp.route("/api/favorites", methods=["GET"])
def get_favorites():
    if not session.get("username"):
        return jsonify({"message": "請先登入"}), 403

    user = users_collection.find_one({"username": session["username"]})
    fav_ids = user.get("favorites", [])
    
    # 查商品資料
    products = []
    for pid in fav_ids:
        prod = products_collection.find_one({"_id": ObjectId(pid)})
        if prod:
            products.append({
                "id": str(prod["_id"]),
                "name": prod["name"],
                "price": prod["price"]
            })

    return jsonify({"favorites": products})

# ------------------------
# 新增收藏
# ------------------------
@favorites_bp.route("/api/favorites/add", methods=["POST"])
def add_favorite():
    if not session.get("username"):
        return jsonify({"message": "請先登入"}), 403

    data = request.json
    product_id = data.get("product_id")
    if not product_id:
        return jsonify({"message": "缺少 product_id"}), 400

    # 確認商品存在
    product = products_collection.find_one({"_id": ObjectId(product_id)})
    if not product:
        return jsonify({"message": "商品不存在"}), 404

    users_collection.update_one(
        {"username": session["username"]},
        {"$addToSet": {"favorites": product_id}}  # addToSet 避免重複
    )

    return jsonify({"message": f"{product['name']} 已加入收藏"})

# ------------------------
# 移除收藏
# ------------------------
@favorites_bp.route("/api/favorites/remove", methods=["POST"])
def remove_favorite():
    if not session.get("username"):
        return jsonify({"message": "請先登入"}), 403

    data = request.json
    product_id = data.get("product_id")
    if not product_id:
        return jsonify({"message": "缺少 product_id"}), 400

    users_collection.update_one(
        {"username": session["username"]},
        {"$pull": {"favorites": product_id}}
    )

    return jsonify({"message": "已從收藏移除"})