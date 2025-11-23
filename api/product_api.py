from flask import Blueprint, jsonify, request, send_file, session
from database.db import db  # db 是 MongoClient().your_db
from bson.objectid import ObjectId
from gridfs import GridFS
import io

product_bp = Blueprint("product", __name__)
fs = GridFS(db)

# 權限檢查 decorator
def role_required(roles):
    def decorator(f):
        def wrapper(*args, **kwargs):
            if session.get("role") not in roles:
                return jsonify({"message": "無權限"}), 403
            return f(*args, **kwargs)
        wrapper.__name__ = f.__name__
        return wrapper
    return decorator


# -------------------- 商品 --------------------

@product_bp.route("/api/products", methods=["GET"])
def get_products():
    products = list(db.products.find())
    return jsonify([{
        "id": str(p["_id"]),
        "name": p["name"],
        "price": p["price"],
        "stock": p.get("stock", 10),
        "description": p.get("description", ""),
        "image_id": str(p.get("image_id")) if p.get("image_id") else None,
        "category": p.get("category", "其他")
    } for p in products])


@product_bp.route("/api/products", methods=["POST"])
@role_required(["admin", "sub-admin"])
def add_product():
    name = request.form.get("name")
    price = float(request.form.get("price"))
    stock = int(request.form.get("stock", 10))
    description = request.form.get("description", "")
    category = request.form.get("category", "其他")
    image_file = request.files.get("image")

    if image_file:
        image_id = fs.put(image_file, filename=image_file.filename)
    else:
        image_id = None

    db.products.insert_one({
        "name": name,
        "price": price,
        "stock": stock,
        "description": description,
        "category": category,
        "image_id": image_id
    })
    return jsonify({"message": "商品新增成功"})


@product_bp.route("/api/products/<product_id>", methods=["PUT"])
@role_required(["admin", "sub-admin"])
def update_product(product_id):
    product = db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        return jsonify({"error": "商品不存在"}), 404

    name = request.form.get("name")
    price = float(request.form.get("price"))
    stock = int(request.form.get("stock", 10))
    description = request.form.get("description", "")
    category = request.form.get("category", product.get("category", "其他"))
    image_file = request.files.get("image")

    update_data = {
        "name": name,
        "price": price,
        "stock": stock,
        "description": description,
        "category": category
    }

    if image_file:
        image_id = fs.put(image_file, filename=image_file.filename)
        update_data["image_id"] = image_id

    db.products.update_one({"_id": ObjectId(product_id)}, {"$set": update_data})
    return jsonify({"message": "商品更新成功"})


@product_bp.route("/api/products/<product_id>", methods=["DELETE"])
@role_required(["admin", "sub-admin"])
def delete_product(product_id):
    db.products.delete_one({"_id": ObjectId(product_id)})
    return jsonify({"message": "商品刪除成功"})


@product_bp.route("/api/products/image/<image_id>")
def get_product_image(image_id):
    try:
        file = fs.get(ObjectId(image_id))
        return send_file(io.BytesIO(file.read()), mimetype="image/jpeg", download_name=file.filename)
    except:
        return jsonify({"error": "圖片不存在"}), 404


# -------------------- 分類 --------------------

@product_bp.route("/api/categories", methods=["GET"])
def get_categories():
    cats = list(db.categories.find({}, {"_id": 0, "name": 1}))
    return jsonify([c["name"] for c in cats])


@product_bp.route("/api/categories", methods=["POST"])
@role_required(["admin", "sub-admin"])
def add_category():
    data = request.get_json()
    name = data.get("name")
    if not name:
        return jsonify({"error": "缺少分類名稱"}), 400

    if db.categories.find_one({"name": name}):
        return jsonify({"error": "分類已存在"}), 400

    db.categories.insert_one({"name": name})
    return jsonify({"message": f"分類 {name} 新增成功"})


@product_bp.route("/api/categories/<old_name>", methods=["PUT"])
@role_required(["admin", "sub-admin"])
def rename_category(old_name):
    data = request.get_json()
    new_name = data.get("new_name")
    if not new_name:
        return jsonify({"error": "缺少新分類名稱"}), 400

    db.categories.update_one({"name": old_name}, {"$set": {"name": new_name}})
    db.products.update_many({"category": old_name}, {"$set": {"category": new_name}})
    return jsonify({"message": f"{old_name} 已改為 {new_name}"})


@product_bp.route("/api/categories/<name>", methods=["DELETE"])
@role_required(["admin", "sub-admin"])
def delete_category(name):
    db.categories.delete_one({"name": name})
    db.products.update_many({"category": name}, {"$set": {"category": "其他"}})
    return jsonify({"message": f"分類 {name} 已刪除，商品歸類到其他"})
