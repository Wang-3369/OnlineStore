from flask import Blueprint, request, jsonify, session, Response
from database.db import promotions_collection, fs, products_collection
from bson import ObjectId
import datetime

promotion_bp = Blueprint("promotion_api", __name__)

# === 前端輪播：取得所有促銷資料（含圖片ID） ===
@promotion_bp.route("/api/promotions", methods=["GET"])
def get_promotions():
    promos = list(promotions_collection.find())
    for p in promos:
        p["_id"] = str(p["_id"])
        p["image_id"] = str(p.get("image_id", ""))
    return jsonify(promos)

# === 取得促銷圖片（給前端直接 <img src=""> 使用） ===
@promotion_bp.route("/api/promotions/image/<image_id>")
def get_promotion_image(image_id):
    try:
        grid_out = fs.get(ObjectId(image_id))
        return Response(grid_out.read(), mimetype=grid_out.content_type)
    except:
        return jsonify({"error": "找不到圖片"}), 404

# === 管理端：上傳促銷圖片 (修正版) ===
@promotion_bp.route("/api/promotions/upload", methods=["POST"])
def upload_promotion_image():
    if session.get("role") not in ["admin", "sub-admin"]:
        return jsonify({"error": "沒有權限"}), 403

    image = request.files.get("image")
    if not image:
        return jsonify({"error": "沒有上傳檔案"}), 400

    # 1. 解析數值
    try:
        title = request.form.get("title", "未命名活動")
        promo_type = request.form.get("promo_type", "discount")
        promo_value = float(request.form.get("promo_value", 1.0))
        threshold = float(request.form.get("threshold", 0))
        scope_type = request.form.get("scope_type", "all")
        scope_value = request.form.get("scope_value")
    except ValueError:
        return jsonify({"error": "數值格式錯誤"}), 400

    # 2. 儲存圖片到 GridFS
    image_id = fs.put(image, filename=image.filename, content_type=image.content_type)

    # 3. 準備資料物件
    promo = {
        "title": title,
        "image_id": image_id,
        "promo_type": promo_type,
        "promo_value": promo_value,
        "threshold": threshold,
        "scope_type": scope_type,
        "scope_value": scope_value,
        "created_at": datetime.datetime.utcnow()
    }
    
    # 修正：原本你寫了兩次 insert_one，這會導致資料重複，刪掉多餘的那行
    result = promotions_collection.insert_one(promo)

    return jsonify({"message": "促銷活動已發布", "id": str(result.inserted_id)})

# === 管理端：刪除促銷圖片 ===
@promotion_bp.route("/api/promotions/<pid>", methods=["DELETE"])
def delete_promotion(pid):
    if session.get("role") not in ["admin", "sub-admin"]:
        return jsonify({"error": "沒有權限"}), 403

    promo = promotions_collection.find_one({"_id": ObjectId(pid)})
    if not promo:
        return jsonify({"error": "找不到促銷資料"}), 404

    # 刪除 GridFS 圖片
    if "image_id" in promo:
        try:
            fs.delete(ObjectId(promo["image_id"]))
        except:
            pass

    promotions_collection.delete_one({"_id": ObjectId(pid)})
    return jsonify({"message": "促銷圖片已刪除"})

# 取得目前所有的商品分類
@promotion_bp.route("/api/admin/categories", methods=["GET"])
def get_categories():
    # 這裡記得確保 products_collection 有被正確導入
    categories = products_collection.distinct("category")
    # 濾掉空的分類
    categories = [c for c in categories if c]
    return jsonify(categories)

# 取得目前所有的商品清單 (用於特定商品選單)
@promotion_bp.route("/api/admin/products_list", methods=["GET"])
def get_products_list():
    # 建議加上排序，方便管理者在下拉選單找商品
    products = list(products_collection.find({}, {"name": 1, "_id": 1}).sort("name", 1))
    for p in products:
        p["_id"] = str(p["_id"])
    return jsonify(products)
