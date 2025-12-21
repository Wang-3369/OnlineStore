from flask import Blueprint, jsonify, request, session
from database.db import db
from datetime import datetime, timedelta, timezone
from bson.objectid import ObjectId
from bson.errors import InvalidId

tw_tz = timezone(timedelta(hours=8))
review_api = Blueprint("review_api", __name__)

reviews_collection = db.product_reviews
products_collection = db.products

def get_tw_time():
    # 強制獲取 UTC 時間並加上 8 小時，回傳一個不帶時區標籤但數值正確的本地時間
    return datetime.utcnow() + timedelta(hours=8)

# ----------------- 新增評論 (使用者) -----------------
@review_api.route("/api/reviews", methods=["POST"])
def add_review():
    username = session.get("username")
    if not username:
        return jsonify({"message": "請先登入"}), 401

    data = request.json
    content = data.get("content")
    rating = data.get("rating")
    order_id = data.get("order_id")  # 訂單 ID
    product_id = data.get("product_id")  # 可選

    if not rating or not (1 <= int(rating) <= 5):
        return jsonify({"message": "請提供 1~5 星評分"}), 400

    # 檢查同一份訂單是否已有評論
    existing_review = reviews_collection.find_one({
        "username": username,
        "order_id": order_id
    })
    if existing_review:
        return jsonify({"message": "此訂單已評論過，不能再次評論"}), 400

    review = {
        "order_id": order_id,
        "product_id": data.get("product_id"),
        "username": username,
        "content": content if content else None, # 如果是空字串就存 None 或維持 content
        "rating": int(rating),
        "created_at": get_tw_time(), # 使用強制校正的時間
        "reply": None
    }

    reviews_collection.insert_one(review)
    return jsonify({"message": "評論成功！"})
# ----------------- 取得所有評論 -----------------
@review_api.route("/api/reviews", methods=["GET"])
def get_reviews():
    username = session.get("username")
    role = session.get("role")
    if not username:
        return jsonify({"message": "請先登入"}), 401

    reviews = list(reviews_collection.find())

    for r in reviews:
        r["_id"] = str(r["_id"])
        r["created_at"] = r["created_at"].isoformat()
        r["can_delete"] = role in ["admin", "sub-admin"]
        r["reply"] = r.get("reply", None)
        # 查商品名稱
        if r.get("product_id"):
            try:
                product = products_collection.find_one({"_id": ObjectId(r["product_id"])})
                r["product_name"] = product["name"] if product else "未知商品"
            except:
                r["product_name"] = "未知商品"
        else:
            r["product_name"] = "未知商品"

    return jsonify(reviews)

# ----------------- 刪除評論 (僅管理者) -----------------
@review_api.route("/api/reviews/<review_id>", methods=["DELETE"])
def delete_review(review_id):
    role = session.get("role")
    if role not in ["admin", "sub-admin"]:
        return jsonify({"message": "沒有權限"}), 403

    try:
        oid = ObjectId(review_id)
    except InvalidId:
        return jsonify({"message": "評論不存在"}), 404

    result = reviews_collection.delete_one({"_id": oid})
    if result.deleted_count == 0:
        return jsonify({"message": "評論不存在"}), 404

    return jsonify({"message": "評論已刪除"})

# ----------------- 回覆評論 (僅管理者) -----------------
@review_api.route("/api/reviews/<review_id>/reply", methods=["POST"])
def reply_review(review_id):
    role = session.get("role")
    if role not in ["admin", "sub-admin"]:
        return jsonify({"message": "沒有權限"}), 403

    data = request.json
    reply_text = data.get("reply")
    if not reply_text:
        return jsonify({"message": "回覆內容不能為空"}), 400

    try:
        oid = ObjectId(review_id)
    except InvalidId:
        return jsonify({"message": "評論不存在"}), 404

    result = reviews_collection.update_one({"_id": oid}, {"$set": {"reply": reply_text}})
    if result.matched_count == 0:
        return jsonify({"message": "評論不存在"}), 404

    return jsonify({"message": "回覆成功"})
