async function fetchProducts() {
    const res = await fetch("/api/products");
    const products = await res.json();
    const list = document.getElementById("product-list");
    list.innerHTML = "";
    products.forEach(p => {
        const div = document.createElement("div");
        div.innerHTML = `
            <strong>${p.name}</strong> - NT$ ${p.price} - 庫存: ${p.stock}
            <button onclick="deleteProduct('${p.id}')">刪除</button>
            <button onclick="editProduct('${p.id}', '${p.name}', ${p.price}, ${p.stock})">修改</button>
        `;
        list.appendChild(div);
    });
}

async function deleteProduct(id) {
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    fetchProducts();
}

function editProduct(id, oldName, oldPrice, oldStock) {
    const name = prompt("新商品名稱", oldName);
    const price = parseFloat(prompt("新價格", oldPrice));
    const stock = parseInt(prompt("新庫存", oldStock));
    
    if(name && !isNaN(price) && !isNaN(stock)) {
        fetch(`/api/products/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, price, stock })
        }).then(fetchProducts);
    } else {
        alert("價格和庫存必須為數字");
    }
}

document.getElementById("add-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    data.price = parseFloat(data.price);
    data.stock = parseInt(data.stock);
    if(isNaN(data.price) || isNaN(data.stock)){
        alert("價格和庫存必須為數字");
        return;
    }

    await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    e.target.reset();
    fetchProducts();
});

document.addEventListener("DOMContentLoaded", () => {
    // ===== Socket.IO 新訂單通知 =====
    const socket = io('http://localhost:5000/admin'); // admin namespace

    // 進入自己的 room
    socket.on('connect', () => {
    if(adminId) {
        socket.emit('join_room', { room: adminId });
        console.log("已加入自己的 room:", adminId);
    }
    });

    // 收到新訂單通知
    socket.on("new_order", (data) => {
    const modal = document.getElementById("orderModal");
    const detailBox = document.getElementById("orderDetails");

    let html = `
        <p><strong>訂單編號：</strong> ${data.order_id}</p>
        <p><strong>使用者：</strong> ${data.username}</p>
        <p><strong>總金額：</strong> ${data.total}</p>
        <p><strong>品項：</strong></p>
        <ul>
    `;

    for (let item of data.products) {
        html += `<li>${item.name} x ${item.quantity}（$${item.price}）</li>`;
    }

    html += "</ul>";

    detailBox.innerHTML = html;
    modal.style.display = "flex";   // 打開 modal

    // 接受
    document.getElementById("acceptOrder").onclick = () => {
        fetch(`/api/admin/order/accept/${data.order_id}`, {
        method: "POST"
        })
        .then(res => res.json())
        .then(resData => {

            if (resData.error) {
                alert("接受訂單失敗：" + resData.error);
                return;
            }

            addMakingOrder(resData.order); // 加入製作清單
            modal.style.display = "none";
        })
        .catch(err => {
            console.error("API 錯誤:", err);
            alert("接受訂單時發生錯誤，請查看 console");
        });
    };

    // 拒絕
    document.getElementById("rejectOrder").onclick = () => {
        socket.emit("order_response", {
            order_id: data.order_id,
            decision: "rejected"
        });
        modal.style.display = "none";
    };

    });
    
    //製作中訂單
    function addMakingOrder(data) {
    const list = document.getElementById("making-list");
    if (!list) return;

    const div = document.createElement("div");
    div.className = "making-item";
    div.dataset.id = data.order_id;

    let html = `<h3>訂單 #${data.order_id}</h3><ul>`;
    for (let key in data.products) {
        const item = data.products[key];
        html += `<li>${item.name} x ${item.quantity}</li>`;
    }
    html += `</ul>
            <button class="finish-btn">完成</button>
            <hr>
        `;

    div.innerHTML = html;
    list.appendChild(div);

    // 功能按鈕
    div.querySelector(".finish-btn").onclick = () => completeOrder(data.order_id, div);
}
});

async function completeOrder(orderId) {
    if (!confirm("確定要將訂單設為完成？")) return;

    const res = await fetch(`/api/admin/order/complete/${orderId}`, {
        method: "POST"
    });
    const data = await res.json();

    if (data.error) {
        alert(data.error);
        return;
    }

    alert(data.message || "訂單已完成");

    // === 從畫面上移除 ===
    const elem = document.querySelector(`.making-item[data-id="${orderId}"]`);
    if (elem) {
        elem.remove();
    }
}
fetchProducts();