from flask import Blueprint, request, session, jsonify
from bson import ObjectId
from database.db import users_collection, products_collection

favorites_bp = Blueprint("favorites_bp", __name__)

# ------------------------
# 取得使用者收藏列表 (修正版：加入 image_id 並優化效能)
# ------------------------
@favorites_bp.route("/api/favorites", methods=["GET"])
def get_favorites():
    if not session.get("username"):
        return jsonify({"message": "請先登入"}), 403

    user = users_collection.find_one({"username": session["username"]})
    if not user:
        return jsonify({"favorites": []})

    fav_ids = user.get("favorites", [])
    
    # 修正：將字串 ID 轉為 ObjectId
    oids = []
    for pid in fav_ids:
        try:
            oids.append(ObjectId(pid))
        except:
            continue

    # 優化：使用 $in 一次性查出所有商品，避免在迴圈中多次讀取資料庫
    products_cursor = products_collection.find({"_id": {"$in": oids}})
    
    products = []
    for prod in products_cursor:
        products.append({
            "id": str(prod["_id"]),
            "name": prod["name"],
            "price": prod["price"],
            "image_id": str(prod.get("image_id", "")) # 重要：補上這行前端才能顯示圖片
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

    try:
        oid = ObjectId(product_id)
    except:
        return jsonify({"message": "無效的商品 ID"}), 400

    # 確認商品存在
    product = products_collection.find_one({"_id": oid})
    if not product:
        return jsonify({"message": "商品不存在"}), 404

    # 使用 $addToSet 確保不會重複收藏同一個 ID
    users_collection.update_one(
        {"username": session["username"]},
        {"$addToSet": {"favorites": product_id}}
    )

    return jsonify({"message": f"「{product['name']}」已加入收藏"})

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