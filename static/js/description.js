document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("product-detail");
    const productId = window.location.pathname.split("/").pop();

    try {
        const res = await fetch(`/api/description/${productId}`);
        if (!res.ok) throw new Error("商品不存在");

        const p = await res.json();

        const imgUrl = p.image_id
            ? `/api/products/image/${p.image_id}?t=${new Date().getTime()}`
            : "/static/images/no-image.png";

        container.innerHTML = `
            <div class="product-detail-container">
                <div class="product-info">
                    <h2>${p.name}</h2>
                    <p><strong>價格：</strong>NT$ ${p.price}</p>
                    <p><strong>庫存：</strong>${p.stock}</p>
                    <p><strong>商品描述：</strong>${p.description || "尚無描述"}</p>
                    <label>數量：
                        <input type="number" id="qty-${p._id}" value="1" min="1" max="${p.stock}">
                    </label>
                    <button id="add-cart-btn"
                            data-id="${p._id}"
                            data-name="${p.name}"
                            data-price="${p.price}"
                            data-image="${imgUrl}">
                        加入購物車
                    </button>
                    <br>
                    <a href="/">回商品列表</a>
                </div>

                <div class="image-section">
                    <img src="${imgUrl}" alt="${p.name}" class="product-image">
                </div>
            </div>
        `;


        // 綁定加入購物車
        document.getElementById("add-cart-btn").addEventListener("click", async () => {
            const qtyInput = document.getElementById(`qty-${p._id}`);
            const quantity = parseInt(qtyInput.value) || 1;

            const res = await fetch("/api/cart/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_id: p._id,
                    quantity,
                    name: p.name,
                    price: p.price,
                    image: imgUrl
                })
            });
            const result = await res.json();
            alert(result.message || "已加入購物車");
        });

    } catch (err) {
        container.innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
});
