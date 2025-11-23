from flask import Blueprint, request, jsonify, session, Response
from database.db import promotions_collection, fs
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

# === 管理端：上傳促銷圖片 ===
@promotion_bp.route("/api/promotions/upload", methods=["POST"])
def upload_promotion_image():
    if session.get("role") not in ["admin", "sub-admin"]:
        return jsonify({"error": "沒有權限"}), 403

    image = request.files.get("image")
    if not image:
        return jsonify({"error": "沒有上傳檔案"}), 400

    # 儲存圖片到 GridFS
    image_id = fs.put(image, filename=image.filename, content_type=image.content_type)

    # 存到 promotions collection，只存圖片 ID
    promo = {
        "image_id": image_id,
        "created_at": datetime.datetime.utcnow()
    }
    result = promotions_collection.insert_one(promo)

    return jsonify({"message": "圖片已上傳", "id": str(result.inserted_id)})

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
