document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("product-list");

    // 取得商品資料
    const res = await fetch("/api/products");
    const products = await res.json();

    container.innerHTML = ""; // 清空容器

    products.forEach(p => {
        const imgUrl = p.image_id 
            ? `/api/products/image/${p.image_id}?t=${new Date().getTime()}`
            : "/static/images/no-image.png";

        const div = document.createElement("div");
        div.classList.add("product-card");
        div.innerHTML = `
            <a href="/description/${p.id}">
                <img src="${imgUrl}" alt="${p.name}" style="width:150px;height:150px;">
                <h3>${p.name}</h3>
            </a>
            <p style="color: #666; font-size: 0.9em;">${p.description || "尚無說明"}</p>
            <p>NT$ ${p.price}</p>
            <p>庫存：${p.stock}</p>
            <label>數量：
                <input type="number" value="1" min="1" max="${p.stock}" id="qty-${p.id}">
            </label>
            <button class="add-cart-btn" 
                    data-id="${p.id}" 
                    data-name="${p.name}" 
                    data-price="${p.price}" 
                    data-image="${imgUrl}">
                加入購物車
            </button>
        `;
        container.appendChild(div);
    });

    // 綁定加入購物車事件
    const buttons = document.querySelectorAll(".add-cart-btn");
    buttons.forEach(btn => {
        btn.addEventListener("click", async () => {
            const productId = btn.dataset.id;
            const qtyInput = document.getElementById(`qty-${productId}`);
            const quantity = parseInt(qtyInput.value) || 1;

            const name = btn.dataset.name;
            const price = parseFloat(btn.dataset.price);
            const image = btn.dataset.image;

            const res = await fetch("/api/cart/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ product_id: productId, quantity, name, price, image })
            });

            const result = await res.json();
            alert(result.message || "已加入購物車");
        });
    });
});
