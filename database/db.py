from pymongo import MongoClient
import gridfs

MONGO_URI = "mongodb+srv://s0970603655_db_user:7A8GtXQQYAPOkeVe@cluster0.upqepzf.mongodb.net/online_store?retryWrites=true&w=majority"
client = MongoClient(MONGO_URI)
db = client["online_store"]

products_collection = db["products"]
users_collection = db["users"]
orders_collection = db["orders"] 
promotions_collection = db["promotions"]

fs = gridfs.GridFS(db)

