from flask import Blueprint, jsonify
from bson.objectid import ObjectId
from bson.errors import InvalidId
from database.db import products_collection

description_bp = Blueprint("description_api", __name__, url_prefix="/api")

@description_bp.route("/description/<product_id>")
def get_product_description(product_id):
    try:
        oid = ObjectId(product_id)
    except InvalidId:
        return jsonify({"error": "商品不存在"}), 404

    product = products_collection.find_one({"_id": oid})
    if not product:
        return jsonify({"error": "商品不存在"}), 404

    # 將所有 ObjectId 轉成字串
    product["_id"] = str(product["_id"])
    if "image_id" in product and isinstance(product["image_id"], ObjectId):
        product["image_id"] = str(product["image_id"])

    return jsonify(product)
