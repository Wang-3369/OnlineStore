import os
import datetime
import io
from flask import Blueprint, request, jsonify, session, Response, make_response
from database.db import promotions_collection, fs, products_collection
from bson import ObjectId
from utils.image import compress_image # 確保你的 utils.py 有這個函式

promotion_bp = Blueprint("promotion_api", __name__)

# === 前端輪播：取得所有促銷資料（含圖片ID） ===
@promotion_bp.route("/api/promotions", methods=["GET"])
def get_promotions():
    promos = list(promotions_collection.find())
    for p in promos:
        p["_id"] = str(p["_id"])
        p["image_id"] = str(p.get("image_id", ""))
    return jsonify(promos)

# === 取得促銷圖片（加入快取優化，解決轉圈圈關鍵） ===
@promotion_bp.route("/api/promotions/image/<image_id>")
def get_promotion_image(image_id):
    try:
        grid_out = fs.get(ObjectId(image_id))
        
        # 使用 make_response 以便自定義 Headers
        response = make_response(grid_out.read())
        
        # 設定正確的圖片類型，若無則預設 jpeg
        response.headers['Content-Type'] = grid_out.content_type or 'image/jpeg'
        
        # 從環境變數讀取快取秒數，預設為 86400 (1天)
        cache_timeout = os.getenv("IMAGE_CACHE_TIMEOUT", "86400")
        response.headers['Cache-Control'] = f'public, max-age={cache_timeout}'
        
        return response
    except Exception as e:
        print(f"促銷圖片讀取錯誤: {e}")
        return jsonify({"error": "找不到圖片"}), 404

# === 管理端：上傳促銷圖片 (加入自動壓縮) ===
@promotion_bp.route("/api/promotions/upload", methods=["POST"])
def upload_promotion_image():
    # 權限檢查
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

    # 2. 執行圖片壓縮 (促銷圖建議設為 1200px)
    try:
        # 使用 env 中的品質設定，預設 75
        q = int(os.getenv("IMAGE_COMPRESSION_QUALITY", 75))
        compressed_io = compress_image(image, max_size=(1200, 1200), quality=q)
        
        # 儲存到 GridFS
        image_id = fs.put(
            compressed_io, 
            filename=image.filename, 
            content_type="image/jpeg"
        )
    except Exception as e:
        print(f"圖片壓縮失敗: {e}")
        # 如果壓縮失敗，回退到原始上傳（或回報錯誤）
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
    
    result = promotions_collection.insert_one(promo)
    return jsonify({"message": "促銷活動已發布", "id": str(result.inserted_id)})

# === 管理端：刪除促銷活動與圖片 ===
@promotion_bp.route("/api/promotions/<pid>", methods=["DELETE"])
def delete_promotion(pid):
    if session.get("role") not in ["admin", "sub-admin"]:
        return jsonify({"error": "沒有權限"}), 403

    try:
        promo = promotions_collection.find_one({"_id": ObjectId(pid)})
        if not promo:
            return jsonify({"error": "找不到促銷資料"}), 404

        # 刪除 GridFS 中的圖片檔案
        if "image_id" in promo:
            try:
                fs.delete(ObjectId(promo["image_id"]))
            except:
                pass

        # 刪除資料庫紀錄
        promotions_collection.delete_one({"_id": ObjectId(pid)})
        return jsonify({"message": "促銷圖片已刪除"})
    except:
        return jsonify({"error": "刪除失敗"}), 500

# 取得目前所有的商品分類
@promotion_bp.route("/api/admin/categories", methods=["GET"])
def get_categories():
    categories = products_collection.distinct("category")
    categories = [c for c in categories if c]
    return jsonify(categories)

# 取得目前所有的商品清單
@promotion_bp.route("/api/admin/products_list", methods=["GET"])
def get_products_list():
    products = list(products_collection.find({}, {"name": 1, "_id": 1}).sort("name", 1))
    for p in products:
        p["_id"] = str(p["_id"])
    return jsonify(products)