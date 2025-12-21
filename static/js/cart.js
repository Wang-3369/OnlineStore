function renderCart(cart) {
    const tbody = document.getElementById("cart-body");
    tbody.innerHTML = "";
    let total = 0;
    for (const id in cart) {
        const item = cart[id];
        const subtotal = item.price * item.quantity;
        total += subtotal;

        const tr = document.createElement("tr");
        const imgHtml = item.image_id ? `<img src="/api/products/image/${item.image_id}" width="50">` : '';
        tr.innerHTML = `
            <td>${imgHtml} ${item.name}</td>
            <td>${item.price}</td>
            <td>
                <input type="number" value="${item.quantity}" min="1" onchange="updateCart('${id}', this.value)">
            </td>
            <td>${subtotal}</td>
            <td><button onclick="removeItem('${id}')">刪除</button></td>
        `;
        tbody.appendChild(tr);
    }
    document.getElementById("total-price").innerText = "總計：NT$ " + total;
    const totalText = "總計：NT$ " + total;
    document.getElementById("total-price").innerText = totalText;
    const modalTotal = document.getElementById("modal-total-display");
    if(modalTotal) modalTotal.innerText = totalText;
}

async function fetchCart() {
    const res = await fetch("/api/cart");
    const data = await res.json();
    renderCart(data.cart || {});
}

async function updateCart(productId, quantity) {
    const res = await fetch("/api/cart/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, quantity: parseInt(quantity) })
    });
    const data = await res.json();
    renderCart(data.cart);
}

async function removeItem(productId) {
    if (!confirm("確定要刪除嗎？")) return;
    const res = await fetch("/api/cart/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId })
    });
    const data = await res.json();
    renderCart(data.cart);
}

document.addEventListener("DOMContentLoaded", () => {
    fetchCart();

    const modal = document.getElementById("checkout-modal");
    const openBtn = document.getElementById("open-checkout-modal");
    const closeBtn = document.querySelector(".close-btn");
    const confirmBtn = document.getElementById("confirm-checkout-btn");

    // 1. 打開彈窗
    // 新增一個計算折扣的函式
    async function calculatePromoPreview() {
        try {
            console.log("開始獲取購物車與促銷資料...");
            const [cartRes, promoRes] = await Promise.all([
                fetch("/api/cart"),
                fetch("/api/promotions")
            ]);
            
            const cartData = await cartRes.json();
            const promotions = await promoRes.json();
            
            // 防呆：確保 promotions 是陣列
            if (!Array.isArray(promotions)) {
                console.error("促銷資料格式錯誤，預期為陣列:", promotions);
                return null;
            }

            const cart = cartData.cart || {};
            const cartItems = Object.entries(cart).map(([id, item]) => ({
                id: id,
                name: item.name,
                price: parseFloat(item.price) || 0,
                quantity: parseInt(item.quantity) || 0,
                category: item.category ? item.category.trim() : "",
                subtotal: (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0)
            }));

            const grandSubtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
            if (grandSubtotal === 0) return null;

            let bestPromo = null;
            let maxDiscountAmt = 0; // 改用最大折扣額來找最優方案

            promotions.forEach(p => {
                let eligibleAmount = 0;
                const scopeType = p.scope_type || 'all';
                // 確保 scopeValue 轉為字串進行比較
                const scopeValue = p.scope_value ? p.scope_value.toString().trim() : "";

                cartItems.forEach(item => {
                    let isMatch = false;
                    if (scopeType === 'all') isMatch = true;
                    else if (scopeType === 'category' && item.category === scopeValue) isMatch = true;
                    else if (scopeType === 'product' && item.id === scopeValue) isMatch = true;

                    if (isMatch) eligibleAmount += item.subtotal;
                });

                const threshold = parseFloat(p.threshold || 0);
                if (eligibleAmount >= threshold && eligibleAmount > 0) {
                    let discountAmt = 0;
                    if (p.promo_type === 'discount') {
                        // 例如 0.9 折，折扣額 = 100 * (1 - 0.9) = 10
                        discountAmt = eligibleAmount * (1 - parseFloat(p.promo_value));
                    } else if (p.promo_type === 'minus') {
                        discountAmt = parseFloat(p.promo_value);
                    }

                    if (discountAmt > maxDiscountAmt) {
                        maxDiscountAmt = discountAmt;
                        bestPromo = {
                            title: p.title,
                            finalTotal: Math.max(0, Math.round(grandSubtotal - discountAmt)),
                            discountAmount: Math.round(discountAmt)
                        };
                    }
                }
            });

            console.log("計算出的最優折扣:", bestPromo);
            return bestPromo;
        } catch (err) {
            console.error("預覽折扣函式內部崩潰:", err);
            return null;
        }
    }

// 修改 openBtn 點擊事件
openBtn?.addEventListener("click", async () => {
    const subtotalText = document.getElementById("total-price").innerText;
    const subtotal = parseInt(subtotalText.replace(/[^\d]/g, "")) || 0;

    if (subtotal === 0) {
        alert("購物車是空的喔！");
        return;
    }

    // 先打開彈窗，讓使用者看到在動
    modal.style.display = "block";
    document.getElementById("modal-total-display").innerText = "計算折扣中...";

    try {
        console.log("開始計算折扣...");
        const bestPromo = await calculatePromoPreview(); // 移除 subtotal 參數，因為函式內沒用到
        console.log("折扣計算完成:", bestPromo);

        const promoSection = document.getElementById("promo-preview-section");
        const subtotalDisplay = document.getElementById("modal-subtotal-display");
        const totalDisplay = document.getElementById("modal-total-display");

        if (bestPromo && bestPromo.discountAmount > 0) {
            promoSection.style.display = "block";
            document.getElementById("promo-title").innerText = bestPromo.title || "限時優惠";
            document.getElementById("discount-detail").innerText = `- NT$ ${bestPromo.discountAmount}`;
            subtotalDisplay.innerText = `原價：NT$ ${subtotal}`;
            subtotalDisplay.style.display = "block";
            totalDisplay.innerText = `實付總計：NT$ ${bestPromo.finalTotal}`;
        } else {
            promoSection.style.display = "none";
            subtotalDisplay.style.display = "none";
            totalDisplay.innerText = `總計：NT$ ${subtotal}`;
        }
    } catch (e) {
        console.error("折扣流程出錯:", e);
        document.getElementById("modal-total-display").innerText = `總計：NT$ ${subtotal}`;
    }

    // 將獲取 Email 放在最後，且不讓它影響主流程
    fetch("/api/profile/info")
        .then(res => res.json())
        .then(userData => {
            const gmailInput = document.getElementById("user-gmail");
            if (userData && userData.email && gmailInput) {
                gmailInput.value = userData.email;
                gmailInput.style.backgroundColor = "#e8f0fe";
            }
        })
        .catch(err => console.log("無法獲取預設 Email，不影響結帳"));
});

    // 2. 關閉彈窗 (點擊 X 或點擊背景)
    closeBtn?.addEventListener("click", () => modal.style.display = "none");
    window.addEventListener("click", (e) => {
        if (e.target == modal) modal.style.display = "none";
    });

    // 3. 確認送出訂單
    confirmBtn?.addEventListener("click", async () => {
        const gmail = document.getElementById("user-gmail").value;
        const diningOption = document.querySelector('input[name="dining-option"]:checked').value;
        const pickupTime = document.getElementById("pickup-time").value;
        const note = document.getElementById("order-note").value;

        // 簡單驗證
        if (!gmail || !gmail.includes('@')) {
            alert("請輸入有效的 Gmail 帳號！");
            return;
        }
        if (!pickupTime) {
            alert("請設定取餐時間！");
            return;
        }

        confirmBtn.disabled = true;
        confirmBtn.innerText = "處理中...";

        try {
            const res = await fetch("/api/cart/checkout", { 
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gmail: gmail,
                    dining_option: diningOption,
                    pickup_time: pickupTime,
                    note: note,
                    payment_method: "cash" // 預設現金
                })
            });
            
            const data = await res.json();
            
            if(res.ok) {
                alert(data.message);
                location.href = "/orders"; 
            } else {
                alert("結帳失敗：" + data.message);
                confirmBtn.disabled = false;
                confirmBtn.innerText = "確認送出訂單";
            }
        } catch (error) {
            alert("連線失敗，請稍後再試");
            confirmBtn.disabled = false;
        }
    });
});