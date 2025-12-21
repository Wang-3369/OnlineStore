import pytest
from unittest.mock import patch

# BS-TC-AUTH-01: 註冊成功
@patch('api.auth_api.users_collection')
def test_register(mock_users_col, client):
    # 模擬：帳號不存在 (find_one 回傳 None)
    mock_users_col.find_one.return_value = None
    
    payload = {"username": "newuser", "password": "qwer1234"}
    response = client.post('/api/register', json=payload)
    
    assert response.status_code == 200
    assert "註冊成功" in response.get_json()['message']

# BS-TC-AUTH-02: 註冊失敗 (帳號已存在)
@patch('api.auth_api.users_collection')
def test_register_fail(mock_users_col, client):
    # 模擬：帳號已存在
    mock_users_col.find_one.return_value = {"username": "newuser"}
    
    payload = {"username": "newuser", "password": "qwer1234"}
    response = client.post('/api/register', json=payload)
    
    assert response.status_code == 400
    assert "帳號已存在" in response.get_json()['message']

# BS-TC-AUTH-03: 登入成功
@patch('api.auth_api.check_password_hash')
@patch('api.auth_api.users_collection')
def test_login(mock_users_col, mock_check_pwd, client):
    # 模擬：找到使用者
    mock_users_col.find_one.return_value = {
        "username": "zzz", 
        "password": "hashed_password", 
        "role": "user"
    }
    # 模擬：密碼驗證成功
    mock_check_pwd.return_value = True

    payload = {"username": "zzz", "password": "qwer1234"}
    response = client.post('/api/login', json=payload)

    assert response.status_code == 200
    assert "登入成功" in response.get_json()['message']

# BS-TC-AUTH-04: 登入失敗 (密碼錯誤)
@patch('api.auth_api.check_password_hash')
@patch('api.auth_api.users_collection')
def test_login_fail(mock_users_col, mock_check_pwd, client):
    mock_users_col.find_one.return_value = {
        "username": "zzz", 
        "password": "hashed_password"
    }
    # 模擬：密碼驗證失敗
    mock_check_pwd.return_value = False

    payload = {"username": "zzz", "password": "aaa"}
    response = client.post('/api/login', json=payload)

    assert response.status_code == 401
    assert "帳號或密碼錯誤" in response.get_json()['message']