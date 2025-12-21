// --- 1. 訂單操作功能 (定義在全域，讓 base.html 的 SSE 能讀到) ---
async function fetchOrders() {
    const res = await fetch("/api/admin/orders");
    const orders = await res.json();
    const container = document.getElementById("orders-container");
    if (!container) return; // 防止在非接單頁面報錯

    container.innerHTML = "";

    if (orders.length === 0) {
        container.innerHTML = "<p class='no-order'>目前沒有訂單</p>";
        return;
    }

    orders.forEach(order => {
        let statusClass = `status-${order.status}`;
        let actionButtons = getActionButtons(order);
        let productsHtml = "<ul>";
        for (const pid in order.products) {
            let p = order.products[pid];
            productsHtml += `<li>${p.name} x ${p.quantity} ($${p.price})</li>`;
        }
        productsHtml += "</ul>";

        const div = document.createElement("div");
        div.className = `order-card ${statusClass}`;
        div.innerHTML = `
            <div class="card-header">
                <h3>單號：${order.order_id}</h3>
                <span class="order-date">${order.created_at.split('T')[0]}</span>
            </div>
            <div class="card-content">
                <p><strong>顧客：</strong> ${order.username}</p>
                <p><strong>狀態：</strong> ${getStatusText(order.status)}</p>
                <p><strong>總金額：</strong> <span class="price">NT$ ${order.total}</span></p>
                <hr>
                ${productsHtml}
            </div>
            <div class="card-footer">${actionButtons}</div>`;
        container.appendChild(div);
    });
}

function getStatusText(status) {
    const statusMap = {
        'pending': '<span style="color:orange;">⏳ 等待確認中</span>',
        'accepted': '<span style="color:blue;">👨‍🍳 製作中</span>',
        'completed': '<span style="color:green;">✅ 已完成</span>',
        'rejected': '<span style="color:red;">❌ 已取消</span>'
    };
    return statusMap[status] || status;
}

function getActionButtons(order) {
    if (order.status === 'pending') {
        return `<button class="btn-accept" onclick="updateStatus('${order.order_id}', 'accepted')">接受訂單</button>
                <button class="btn-reject" onclick="updateStatus('${order.order_id}', 'rejected')">拒絕訂單</button>`;
    } else if (order.status === 'accepted') {
        return `<button class="btn-complete" onclick="updateStatus('${order.order_id}', 'completed')">通知餐點完成</button>`;
    }
    return `<span>已結束</span>`;
}

// --- 修正後的 updateStatus 函式 ---
async function updateStatus(orderId, status) {
    const btn = event.target; 
    const originalText = btn.innerText;
    
    if (!confirm(`確定要變更狀態為 ${status} 嗎？`)) return;

    btn.disabled = true;
    btn.innerText = "處理中...";

    try {
        const res = await fetch("/api/admin/order/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: orderId, status: status })
        });

        // 💡 這裡其實不需要手動呼叫 fetchOrders()，
        // 因為下面的 Pusher 監聽會幫你執行全自動刷新。
    } catch (error) {
        console.error("更新出錯:", error);
        alert("網路連線異常");
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

document.addEventListener("DOMContentLoaded", fetchOrders);