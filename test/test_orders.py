import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime
from bson import ObjectId

# BS-TC-ORD-01: 取得使用者訂單
@patch('api.orders_api.orders_collection')
@patch('api.orders_api.product_reviews_collection')
def test_get_orders(mock_reviews_col, mock_orders_col, client):
    with client.session_transaction() as sess:
        sess['username'] = "user1"

    mock_order = {
        "_id": ObjectId("507f1f77bcf86cd799439011"),
        "order_id": "ORD-01",
        "total": 100,
        "username": "user1",
        "created_at": datetime.now()
    }
    mock_cursor = MagicMock()
    
    mock_cursor.sort.return_value = [mock_order]
    
    mock_cursor.__iter__.return_value = [mock_order]
    
    mock_orders_col.find.return_value = mock_cursor
    mock_reviews_col.find_one.return_value = None

    response = client.get('/api/orders')
    
    assert response.status_code == 200
    orders = response.get_json()['orders']
    assert len(orders) == 1
    assert orders[0]['order_id'] == "ORD-01"