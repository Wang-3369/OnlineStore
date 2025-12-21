import pytest
from unittest.mock import patch, MagicMock
from bson import ObjectId
import json

# BS-TC-ADM-01: 取得使用者列表
@patch('api.admin_api.users_collection')
def test_get_users(mock_users_col, client):
    with client.session_transaction() as sess:
        sess['role'] = 'admin'

    mock_users_col.find.return_value = [
        {"_id": ObjectId("507f1f77bcf86cd799439011"), "username": "user1", "role": "user"}
    ]
    
    response = client.get('/api/admin/users')
    
    assert response.status_code == 200
    assert len(response.get_json()) == 1

# BS-TC-ADM-02: 提升使用者
@patch('api.admin_api.users_collection')
def test_promote_user(mock_users_col, client):
    with client.session_transaction() as sess:
        sess['role'] = 'admin'
    
    pid = "507f1f77bcf86cd799439011"
    mock_users_col.find_one.return_value = {
        "_id": ObjectId(pid), "username": "user2", "role": "user"
    }

    payload = {"user_id": pid}
    response = client.post('/api/admin/promote', json=payload)
    
    assert response.status_code == 200
    assert "已升級為次管理者" in response.get_json()['message']

# BS-TC-ADM-03: 接受訂單
@patch('api.admin_api.orders_collection')
@patch('api.admin_api.announcer')
def test_update_order_status_accept(mock_announcer, mock_orders_col, client):
    with client.session_transaction() as sess:
        sess['role'] = 'admin'

    mock_orders_col.find_one.return_value = {"order_id": "1234", "username": "user1"}
    
    # 模擬 update_one 的回傳結果，設定 modified_count 為 1
    mock_result = MagicMock()
    mock_result.modified_count = 1
    mock_orders_col.update_one.return_value = mock_result

    payload = {"order_id": "1234", "status": "accepted"}
    response = client.post('/api/admin/order/status', json=payload)
    
    assert response.status_code == 200
    assert "訂單狀態已更新為" in response.get_json()['message']

# BS-TC-ADM-04: 拒絕訂單 (會觸發回補庫存)
@patch('api.admin_api.products_collection') 
@patch('api.admin_api.orders_collection')
@patch('api.admin_api.announcer')
def test_update_order_status_reject(mock_announcer, mock_orders_col, mock_products_col, client):
    with client.session_transaction() as sess:
        sess['role'] = 'admin'

    mock_orders_col.find_one.return_value = {
        "order_id": "1234", 
        "username": "user1", 
        "status": "pending",
        "products": {"507f1f77bcf86cd799439011": {"quantity": 2}}
    }
    
    # 設定 update_one 回傳值
    mock_result = MagicMock()
    mock_result.modified_count = 1
    mock_orders_col.update_one.return_value = mock_result
    mock_products_col.update_one.return_value.modified_count = 1

    payload = {"order_id": "1234", "status": "rejected"}
    response = client.post('/api/admin/order/status', json=payload)
    
    assert response.status_code == 200
    # 確保有呼叫資料庫更新 (回補庫存)
    mock_products_col.update_one.assert_called()