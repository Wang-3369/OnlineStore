from flask import Blueprint, request, jsonify
from database.db import settings_collection

store_hour_bp = Blueprint("store_hour_bp", __name__)

# 取得營業時間
@store_hour_bp.route("/api/admin/store-hours/get", methods=["GET"])
def get_store_hours():
    doc = settings_collection.find_one({"_id": "store_hours"})
    return jsonify({
        "start": doc.get("start", 6) if doc else 6,
        "end": doc.get("end", 24) if doc else 24
    })

# 更新營業時間
@store_hour_bp.route("/api/admin/store-hours/update", methods=["POST"])
def update_store_hours():
    data = request.json

    try:
        start = int(data.get("start"))
        end = int(data.get("end"))
    except:
        return jsonify({"message": "start 或 end 必須是數字"}), 400

    settings_collection.update_one(
        {"_id": "store_hours"},
        {"$set": {"start": start, "end": end}},
        upsert=True
    )

    return jsonify({"message": "營業時間已更新"})