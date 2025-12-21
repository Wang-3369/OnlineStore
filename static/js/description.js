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

        // 1. 先生成 HTML
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
                    <button id="add-cart-btn">加入購物車</button>
                    <br>
                    <a href="/">回商品列表</a>
                </div>
                <div class="image-section">
                    <img src="${imgUrl}" alt="${p.name}" class="product-image">
                </div>
            </div>
        `;

        // 2. HTML 生成後，立即抓取該按鈕並綁定「加強版」事件
        const addBtn = document.getElementById("add-cart-btn");
        
        addBtn.addEventListener("click", async () => {
            const qtyInput = document.getElementById(`qty-${p._id}`);
            const quantity = parseInt(qtyInput.value) || 1;

            // 禁用按鈕，防止重複點擊
            addBtn.disabled = true;
            const originalText = addBtn.innerText;
            addBtn.innerText = "處理中...";

            try {
                const res = await fetch("/api/cart/add", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        product_id: p._id,
                        quantity: quantity
                    })
                });
                
                const result = await res.json();

                if (res.ok) {
                    // 成功：變綠色並改文字
                    addBtn.style.background = "#2ecc71"; 
                    addBtn.style.boxShadow = "0 6px 20px rgba(46, 204, 113, 0.4)";
                    addBtn.innerText = "✓ 已加入購物車";
                    
                    setTimeout(() => {
                        addBtn.style.background = ""; // 恢復原本 CSS 的顏色
                        addBtn.style.boxShadow = "";
                        addBtn.innerText = originalText;
                        addBtn.disabled = false;
                    }, 2000);
                } else {
                    // 失敗 (例如庫存不足或非點餐時間)
                    alert(result.message);
                    addBtn.disabled = false;
                    addBtn.innerText = originalText;
                }
            } catch (err) {
                alert("網路連線失敗");
                addBtn.disabled = false;
                addBtn.innerText = originalText;
            }
        });

    } catch (err) {
        container.innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
});