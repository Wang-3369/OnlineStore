document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("favorites-container");
    container.innerHTML = "";

    try {
        const res = await fetch("/api/favorites");
        const data = await res.json();
        const products = data.favorites;

        if (!products.length) {
            container.innerHTML = "<p>目前沒有收藏商品</p>";
            return;
        }

        products.forEach(p => {
            const imgUrl = p.image_id
                ? `/api/products/image/${p.image_id}`
                : "/static/images/no-image.png";

            const card = document.createElement("div");
            card.className = "product-card";
            card.innerHTML = `
                <a href="/description/${p.id}">
                    <img src="${imgUrl}" alt="${p.name}">
                    <h3>${p.name}</h3>
                </a>
                <p>NT$ ${p.price}</p>
                <label>數量：
                    <input type="number" value="1" min="1" id="qty-${p.id}">
                </label>
                <button class="add-cart-btn"
                    data-id="${p.id}"
                    data-name="${p.name}"
                    data-price="${p.price}">
                    加入購物車
                </button>
                <button class="fav-btn added" data-id="${p.id}">取消收藏</button>
            `;
            container.appendChild(card);
        });

        bindAddCartButtons();
        bindFavoriteButtons();

    } catch (err) {
        console.error("抓收藏商品失敗", err);
    }
});

function bindAddCartButtons() {
    document.querySelectorAll(".add-cart-btn").forEach(btn => {
        btn.onclick = async () => {
            const productId = btn.dataset.id;
            const qty = parseInt(document.getElementById(`qty-${productId}`).value) || 1;
            const res = await fetch("/api/cart/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ product_id: productId, quantity: qty })
            });
            const result = await res.json();
            alert(result.message || "已加入購物車");
        };
    });
}

function bindFavoriteButtons() {
    document.querySelectorAll(".fav-btn").forEach(btn => {
        btn.onclick = async () => {
            const productId = btn.dataset.id;
            const action = btn.classList.contains("added") ? "remove" : "add";

            try {
                const res = await fetch(`/api/favorites/${action}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ product_id: productId })
                });
                const data = await res.json();
                if (res.ok) {
                    btn.classList.toggle("added");
                    btn.innerText = btn.classList.contains("added") ? "取消收藏" : "收藏";
                } else {
                    alert(data.message);
                }
            } catch (err) {
                console.error("收藏操作失敗", err);
            }
        };
    });
}