function renderCart(cart) {
    const tbody = document.getElementById("cart-body");
    tbody.innerHTML = "";
    let total = 0;
    for (const id in cart) {
        const item = cart[id];
        const subtotal = item.price * item.quantity;
        total += subtotal;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${item.name}</td>
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
            // 同時獲取購物車與促銷資訊
            const [cartRes, promoRes] = await Promise.all([
                fetch("/api/cart"),
                fetch("/api/promotions")
            ]);
            
            const cartData = await cartRes.json();
            const promotions = await promoRes.json();
            const cart = cartData.cart || {};

            // 轉換購物車格式
            const cartItems = Object.entries(cart).map(([id, item]) => ({
                id: id,
                name: item.name,
                price: parseFloat(item.price),
                quantity: parseInt(item.quantity),
                category: item.category ? item.category.trim() : "", // 關鍵：確保有類別資訊
                subtotal: parseFloat(item.price) * parseInt(item.quantity)
            }));

            const grandSubtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
            if (grandSubtotal === 0) return null;

            let bestPromo = null;
            let minFinalTotal = grandSubtotal;

            promotions.forEach(p => {
                let eligibleAmount = 0;
                const scopeType = p.scope_type || 'all';
                const scopeValue = (p.scope_value || '').toString().trim();

                // 根據範疇過濾適用商品金額
                cartItems.forEach(item => {
                    let isMatch = false;
                    if (scopeType === 'all') {
                        isMatch = true;
                    } else if (scopeType === 'category' && item.category === scopeValue) {
                        isMatch = true;
                    } else if (scopeType === 'product' && item.id === scopeValue) {
                        isMatch = true;
                    }

                    if (isMatch) eligibleAmount += item.subtotal;
                });

                // 判斷門檻
                const threshold = parseFloat(p.threshold || 0);
                if (eligibleAmount >= threshold && eligibleAmount > 0) {
                    let discountAmt = 0;
                    if (p.promo_type === 'discount') {
                        // 折扣額 = 適用商品總額 * (1 - 折扣率)
                        discountAmt = eligibleAmount * (1 - parseFloat(p.promo_value));
                    } else if (p.promo_type === 'minus') {
                        discountAmt = parseFloat(p.promo_value);
                    }

                    const currentFinalTotal = grandSubtotal - discountAmt;
                    
                    if (currentFinalTotal < minFinalTotal) {
                        minFinalTotal = currentFinalTotal;
                        bestPromo = {
                            title: p.title,
                            finalTotal: Math.max(0, Math.round(minFinalTotal)),
                            discountAmount: Math.round(discountAmt)
                        };
                    }
                }
            });

            return bestPromo;
        } catch (err) {
            console.error("預覽折扣失敗", err);
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

    // 顯示載入中狀態
    document.getElementById("modal-total-display").innerText = "計算折扣中...";
    modal.style.display = "block";

    // 1. 獲取折扣預覽
    const bestPromo = await calculatePromoPreview(subtotal);
    
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
        totalDisplay.style.color = "#e74c3c"; // 變紅強調
        totalDisplay.style.fontSize = "1.5rem";
    } else {
        promoSection.style.display = "none";
        subtotalDisplay.style.display = "none";
        totalDisplay.innerText = `總計：NT$ ${subtotal}`;
        totalDisplay.style.color = "#333";
    }

        // 2. 獲取使用者現有的 Email (新增部分)
        try {
            const res = await fetch("/api/profile/info"); // 我們需要一個能回傳使用者資料的 API
            if (res.ok) {
                const userData = await res.json();
                const gmailInput = document.getElementById("user-gmail");
                if (userData.email) {
                    gmailInput.value = userData.email;
                    // 可以加個提示或樣式讓使用者知道這是帶入的
                    gmailInput.style.backgroundColor = "#e8f0fe"; 
                }
            }
        } catch (err) {
            console.log("無法獲取使用者預設 Email");
        }

        modal.style.display = "block";
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