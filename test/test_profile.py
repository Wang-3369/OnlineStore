import pytest
from unittest.mock import patch
from werkzeug.security import generate_password_hash
from bson import ObjectId

# BS-TC-PROF-01: 修改密碼成功
@patch('api.profile_api.db.users')
def test_change_password(mock_db_users, client):
    with client.session_transaction() as sess:
        sess['username'] = 'user1'

    mock_db_users.find_one.return_value = {
        "_id": ObjectId("507f1f77bcf86cd799439011"),
        "username": "user1",
        "password": generate_password_hash("abcd1234")
    }

    payload = {"old_password": "abcd1234", "new_password": "qwer1234"}
    response = client.post('/api/profile/change_password', json=payload)

    assert response.status_code == 200
    assert "密碼修改成功" in response.get_json()['message']

# BS-TC-PROF-02: 修改密碼失敗 (舊密碼錯誤)
@patch('api.profile_api.db.users')
def test_change_password_fail(mock_db_users, client):
    with client.session_transaction() as sess:
        sess['username'] = 'user1'

    mock_db_users.find_one.return_value = {
        "_id": ObjectId("507f1f77bcf86cd799439011"),
        "username": "user1",
        "password": generate_password_hash("real_password")
    }

    payload = {"old_password": "wrong_password", "new_password": "qwer1234"}
    response = client.post('/api/profile/change_password', json=payload)

    assert response.status_code == 400
    assert "舊密碼錯誤" in response.get_json()['message']