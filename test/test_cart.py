import pytest
from unittest.mock import patch, MagicMock

# 定義一個合法的 MongoDB ObjectId 字串
VALID_ID = "507f1f77bcf86cd799439011"

# BS-TC-CART-01: 營業時間加入購物車
@patch('api.cart_api.products_collection')
@patch('api.cart_api.datetime')
def test_add_to_cart(mock_datetime, mock_products_col, client):
    mock_now = MagicMock()
    mock_now.hour = 9
    mock_datetime.now.return_value = mock_now
    
    # 使用合法的 ID
    mock_products_col.find_one.return_value = {
        "_id": VALID_ID, "name": "蛋餅", "price": 20, "stock": 100
    }

    with client.session_transaction() as sess:
        sess['cart'] = {}

    # payload 也要用合法的 ID
    payload = {"product_id": VALID_ID, "quantity": 1}
    response = client.post('/api/cart/add', json=payload)
    
    assert response.status_code == 200
    assert "蛋餅 已加入購物車" in response.get_json()['message']

# BS-TC-CART-02: 非營業時間加入購物車
@patch('api.cart_api.datetime')
def test_add_to_cart_closed(mock_datetime, client):
    mock_now = MagicMock()
    mock_now.hour = 4 
    mock_datetime.now.return_value = mock_now

    payload = {"product_id": VALID_ID, "quantity": 1}
    response = client.post('/api/cart/add', json=payload)

    assert response.status_code == 400
    assert "非點餐時間" in response.get_json()['message']

# BS-TC-CART-03: 加入庫存不足商品
@patch('api.cart_api.products_collection')
@patch('api.cart_api.datetime')
def test_add_to_cart_no_stock(mock_datetime, mock_products_col, client):
    mock_now = MagicMock()
    mock_now.hour = 9
    mock_datetime.now.return_value = mock_now

    mock_products_col.find_one.return_value = {
        "_id": VALID_ID, "name": "蛋餅", "price": 20, "stock": 0
    }

    with client.session_transaction() as sess:
        sess['cart'] = {}

    payload = {"product_id": VALID_ID, "quantity": 1}
    response = client.post('/api/cart/add', json=payload)

    assert response.status_code == 400
    # 現在 ID 合法，應該會順利檢查到庫存不足
    assert "庫存不足" in response.get_json()['message']

# BS-TC-CART-04: 正常結帳
@patch('api.cart_api.orders_collection')
@patch('api.cart_api.products_collection')
@patch('api.cart_api.announcer') 
def test_checkout(mock_announcer, mock_products_col, mock_orders_col, client):
    with client.session_transaction() as sess:
        sess['username'] = "user1"
        sess['cart'] = {
            VALID_ID: {"name": "蛋餅", "price": 20, "quantity": 2} # 這裡也要用合法 ID
        }

    mock_products_col.update_one.return_value.modified_count = 1

    payload = {"pickup_time": "10:00", "note": ""}
    response = client.post('/api/cart/checkout', json=payload)

    assert response.status_code == 200
    assert "結帳成功" in response.get_json()['message']

# BS-TC-CART-05: 結帳未選時間
def test_checkout_no_time(client):
    with client.session_transaction() as sess:
        sess['username'] = "user1"
        sess['cart'] = {VALID_ID: {"quantity": 1}}

    payload = {"pickup_time": "", "note": ""}
    response = client.post('/api/cart/checkout', json=payload)

    assert response.status_code == 400
    assert "請選擇取餐時間" in response.get_json()['message']