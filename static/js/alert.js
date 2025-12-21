// --- 資源初始化 ---
const alertAudio = new Audio("/static/audio/alert.mp3");
const PUSHER_KEY = '49507dd1bd4ba1a21d4d';
const PUSHER_CLUSTER = 'ap3';

/**
 * 顯示自定義通知彈窗
 */
function showNotificationPopup(title, message, url, type = 'admin') {
    alertAudio.play().catch(() => console.log("等待互動以播放音效"));

    const toast = document.createElement("div");
    toast.className = `custom-notification ${type === 'user' ? 'user-update' : 'admin-update'}`;
    
    toast.innerHTML = `
        <div class="notification-title">${title}</div>
        <div class="notification-body">${message}</div>
        <div class="notification-hint">點擊立刻前往處理 ➔</div>
    `;

    toast.onclick = () => { window.location.href = url; };
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(120%)";
        setTimeout(() => toast.remove(), 500);
    }, 6000);
}

/**
 * 初始化 Pusher 監聽
 */
function setupPusher() {
    const currentUser = document.body.dataset.username;
    const userRole = document.body.dataset.role;

    if (!currentUser) return;

    const pusher = new Pusher(PUSHER_KEY, {
        cluster: PUSHER_CLUSTER,
        forceTLS: true
    });

    // --- A. 管理員邏輯 (admin-channel) ---
    if (userRole === "admin" || userRole === "sub-admin") {
        const adminChannel = pusher.subscribe('admin-channel');
        
        // 監聽 1：新訂單 (跳彈窗 + 刷新列表)
        adminChannel.bind('new-order', function(data) {
            if (data.username !== currentUser) {
                showNotificationDot("/admin/orders");
                showNotificationPopup("🚨 新訂單通知", `來自 ${data.username} 的新訂單`, "/admin/orders", 'admin');
                if (typeof fetchOrders === "function") fetchOrders();
            }
        });

        // 監聽 2：狀態變更 (解決管理頁面同步問題)
        adminChannel.bind('order-status-updated', function(data) {
            console.log("偵測到狀態變更，自動刷新列表...");
            if (typeof fetchOrders === "function") fetchOrders(); 
        });
    }

    // --- B. 使用者邏輯 (監聽自己的訂單頻道) ---
    const userChannel = pusher.subscribe(`user-${currentUser}`);
    
    userChannel.bind('order-update', function(data) {
        showNotificationDot("orders-btn");
        showNotificationPopup(
            "🍳 餐點進度更新", 
            `訂單 <b>#${data.order_id}</b><br>最新狀態：<span style="color:#2e7d32; font-weight:bold;">${data.status}</span>`,
            "/orders",
            'user'
        );

        if (window.location.pathname === "/orders") {
            setTimeout(() => location.reload(), 2000);
        }
    });
}

/**
 * 紅點提醒
 */
function showNotificationDot(targetId) {
    document.getElementById("user-container")?.classList.add("notification-dot");
    const btn = document.querySelector(`button[data-url="${targetId}"]`) || document.getElementById(targetId);
    btn?.classList.add("notification-dot");
}

// --- DOM 載入後啟動 ---
document.addEventListener("DOMContentLoaded", () => {
    setupPusher();

    document.getElementById("user-icon")?.addEventListener("click", () => {
        document.getElementById("user-container")?.classList.remove("notification-dot");
    });

    document.addEventListener("click", (e) => {
        const target = e.target.closest(".notification-dot");
        if (target) target.classList.remove("notification-dot");
    });
});