import pytest
from flask import Flask
from unittest.mock import MagicMock
import os

# 匯入您的 Blueprints
from api.auth_api import auth_bp
from api.cart_api import cart_bp
from api.product_api import product_bp
from api.orders_api import orders_bp
from api.admin_api import admin_bp
from api.profile_api import profile_bp
from api.review_api import review_api

@pytest.fixture
def client():
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.config['SECRET_KEY'] = 'test_secret'
    
    # 註冊所有 Blueprint
    app.register_blueprint(auth_bp)
    app.register_blueprint(cart_bp)
    app.register_blueprint(product_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(review_api)

    # 建立測試客戶端環境
    with app.test_client() as client:
        with app.app_context():
            yield client