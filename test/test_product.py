import pytest
from unittest.mock import patch
from bson import ObjectId

# BS-TC-PROD-01: 取得所有商品
@patch('api.product_api.db.products')
def test_get_products(mock_db_products, client):
    # 模擬回傳列表
    mock_db_products.find.return_value = [
        {"_id": ObjectId("507f1f77bcf86cd799439011"), "name": "蛋餅", "price": 20, "stock": 10}
    ]
    
    response = client.get('/api/products')
    
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 1
    assert data[0]['name'] == "蛋餅"

# BS-TC-PROD-02: 新增商品 (需管理員權限)
@patch('api.product_api.fs') 
@patch('api.product_api.db.products')
def test_add_products(mock_db_products, mock_fs, client):
    # 模擬管理員登入
    with client.session_transaction() as sess:
        sess['role'] = 'admin'
    
    data = {
        "name": "蛋餅",
        "price": 20,
        "stock": 100,
        "category": "蛋餅"
    }
    response = client.post('/api/products', data=data)
    
    assert response.status_code == 200
    assert "商品新增成功" in response.get_json()['message']

# BS-TC-PROD-03: 修改商品
@patch('api.product_api.db.products')
def test_update_products(mock_db_products, client):
    with client.session_transaction() as sess:
        sess['role'] = 'admin'

    # 模擬商品存在
    mock_db_products.find_one.return_value = {"_id": ObjectId("507f1f77bcf86cd799439011"), "category": "其他"}
    
    pid = "507f1f77bcf86cd799439011"
    data = {"name": "蛋餅", "price": 25, "stock": 50}
    
    response = client.put(f'/api/products/{pid}', data=data)
    
    assert response.status_code == 200
    assert "商品更新成功" in response.get_json()['message']

# BS-TC-PROD-04: 刪除商品
@patch('api.product_api.db.products')
def test_delete_product(mock_db_products, client):
    with client.session_transaction() as sess:
        sess['role'] = 'admin'
        
    pid = "507f1f77bcf86cd799439011"
    response = client.delete(f'/api/products/{pid}')
    
    assert response.status_code == 200
    assert "商品刪除成功" in response.get_json()['message']