from flask import Blueprint, jsonify, request, session
from database.db import products_collection
from bson.objectid import ObjectId

product_bp = Blueprint("product", __name__)

def role_required(roles):
    def decorator(f):
        def wrapper(*args, **kwargs):
            if session.get("role") not in roles:
                return jsonify({"message": "無權限"}), 403
            return f(*args, **kwargs)
        wrapper.__name__ = f.__name__
        return wrapper
    return decorator

# 取得商品
@product_bp.route("/api/products", methods=["GET"])
def get_products():
    products = list(products_collection.find())
    return jsonify([{
        "id": str(p["_id"]),
        "name": p["name"],
        "price": p["price"],
        "stock": p.get("stock", 10)
    } for p in products])

# 新增商品 (管理者/次管理者)
@product_bp.route("/api/products", methods=["POST"])
@role_required(["admin", "sub-admin"])
def add_product():
    data = request.json
    products_collection.insert_one({
        "name": data["name"],
        "price": data["price"],
        "stock": data.get("stock", 10)
    })
    return jsonify({"message": "商品新增成功"})

# 更新商品 (管理者/次管理者)
@product_bp.route("/api/products/<product_id>", methods=["PUT"])
@role_required(["admin", "sub-admin"])
def update_product(product_id):
    data = request.json
    result = products_collection.update_one(
        {"_id": ObjectId(product_id)},
        {"$set": {
            "name": data.get("name"),
            "price": data.get("price"),
            "stock": data.get("stock")
        }}
    )
    if result.matched_count == 0:
        return jsonify({"error": "商品不存在"}), 404
    return jsonify({"message": "商品更新成功"})

# 刪除商品 (管理者/次管理者)
@product_bp.route("/api/products/<product_id>", methods=["DELETE"])
@role_required(["admin", "sub-admin"])
def delete_product(product_id):
    result = products_collection.delete_one({"_id": ObjectId(product_id)})
    if result.deleted_count == 0:
        return jsonify({"error": "商品不存在"}), 404
    return jsonify({"message": "商品刪除成功"})

