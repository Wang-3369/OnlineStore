document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("favorites-container");
    if (!container) return; // 確保容器存在

    container.innerHTML = "<p>載入中...</p>";

    try {
        const res = await fetch("/api/favorites");
        const data = await res.json();

        if (!res.ok) {
            container.innerHTML = `<p class="error">${data.message || "無法載入收藏清單"}</p>`;
            return;
        }

        const products = data.favorites;

        if (!products || products.length === 0) {
            container.innerHTML = "<p>目前沒有收藏商品</p>";
            return;
        }

        // 清空並渲染
        container.innerHTML = "";
        products.forEach(p => {
            // 確保後端有回傳 image_id，否則顯示預設圖
            const imgUrl = p.image_id
                ? `/api/products/image/${p.image_id}`
                : "/static/images/no-image.png";

            const card = document.createElement("div");
            card.className = "product-card";
            card.id = `fav-card-${p.id}`; // 給予唯一 ID 方便移除
            card.innerHTML = `
                <a href="/description/${p.id}">
                    <img src="${imgUrl}" alt="${p.name}">
                    <h3>${p.name}</h3>
                </a>
                <p class="price">NT$ ${p.price}</p>
                <div class="cart-controls">
                    <label>數量：
                        <input type="number" value="1" min="1" id="qty-${p.id}">
                    </label>
                    <button class="add-cart-btn" data-id="${p.id}">加入購物車</button>
                </div>
                <button class="fav-btn added" data-id="${p.id}">取消收藏</button>
            `;
            container.appendChild(card);
        });

        // 綁定事件
        bindAddCartButtons();
        bindFavoriteButtons();

    } catch (err) {
        console.error("抓收藏商品失敗", err);
        container.innerHTML = "<p>連線伺服器失敗，請稍後再試</p>";
    }
});

/**
 * 處理「加入購物車」邏輯
 */
function bindAddCartButtons() {
    document.querySelectorAll(".add-cart-btn").forEach(btn => {
        btn.onclick = async () => {
            const productId = btn.dataset.id;
            const qtyInput = document.getElementById(`qty-${productId}`);
            const qty = parseInt(qtyInput.value) || 1;

            try {
                const res = await fetch("/api/cart/add", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ product_id: productId, quantity: qty })
                });

                const result = await res.json();
                
                if (res.ok) {
                    alert(result.message || "成功加入購物車");
                } else {
                    // 處理 400 (營業時間外) 或 403 (未登入)
                    alert("提示：" + (result.message || "加入失敗"));
                }
            } catch (err) {
                alert("網路異常，請檢查連線");
            }
        };
    });
}

/**
 * 處理「取消收藏」邏輯（點擊後直接從頁面移除）
 */
function bindFavoriteButtons() {
    const container = document.getElementById("favorites-container");

    document.querySelectorAll(".fav-btn").forEach(btn => {
        btn.onclick = async () => {
            const productId = btn.dataset.id;

            try {
                // 這裡固定使用 remove 路徑，因為在收藏頁面通常只有取消操作
                const res = await fetch("/api/favorites/remove", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ product_id: productId })
                });

                const data = await res.json();

                if (res.ok) {
                    // 1. 動態移除 DOM 元素
                    const card = document.getElementById(`fav-card-${productId}`);
                    if (card) {
                        card.style.transition = "opacity 0.3s ease";
                        card.style.opacity = "0";
                        setTimeout(() => {
                            card.remove();
                            // 2. 檢查是否全部刪光了
                            if (container.querySelectorAll(".product-card").length === 0) {
                                container.innerHTML = "<p>目前沒有收藏商品</p>";
                            }
                        }, 300);
                    }
                } else {
                    alert(data.message || "操作失敗");
                }
            } catch (err) {
                console.error("收藏操作失敗", err);
                alert("系統忙碌中，請稍後再試");
            }
        };
    });
}