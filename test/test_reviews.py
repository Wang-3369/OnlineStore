import pytest
from unittest.mock import patch
from datetime import datetime
from bson import ObjectId

# BS-TC-REV-01: 取得所有評論
@patch('api.review_api.products_collection')
@patch('api.review_api.reviews_collection')
def test_get_reviews(mock_reviews_col, mock_products_col, client):
    with client.session_transaction() as sess:
        sess['username'] = 'user1'

    mock_reviews_col.find.return_value = [{
        "_id": ObjectId("507f1f77bcf86cd799439011"),
        "username": "user1",
        "content": "好",
        "rating": 5,
        "created_at": datetime.now()
    }]
    
    response = client.get('/api/reviews')
    assert response.status_code == 200
    assert len(response.get_json()) == 1

# BS-TC-REV-02: 新增評論
@patch('api.review_api.reviews_collection')
def test_add_review(mock_reviews_col, client):
    with client.session_transaction() as sess:
        sess['username'] = 'user1'

    # 模擬尚未評論過
    mock_reviews_col.find_one.return_value = None

    payload = {
        "order_id": "ORD-01",
        "content": "很好吃",
        "rating": 5
    }
    response = client.post('/api/reviews', json=payload)
    
    assert response.status_code == 200
    assert "評論成功" in response.get_json()['message']