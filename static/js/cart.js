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

    const checkoutBtn = document.getElementById("checkout-btn");
    checkoutBtn?.addEventListener("click", async () => {
        const pickupTime = document.getElementById("pickup-time").value;
        if (!pickupTime) {
            alert("請設定取餐時間！");
            return;
        }

        const res = await fetch("/api/cart/checkout", { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pickup_time: pickupTime }) // 傳送時間
        });
        const data = await res.json();
        if(res.ok) {
            alert(data.message);
            fetchCart();
            location.href = "/orders";  // 結帳後刷新購物車
        } else {
            alert(data.message);
        }
    });
});