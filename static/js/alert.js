// --- 資源初始化 ---
const alertAudio = new Audio("/static/audio/alert.mp3");
const PUSHER_KEY = '49507dd1bd4ba1a21d4d';
const PUSHER_CLUSTER = 'ap3';

/**
 * 核心功能：顯示自定義通知彈窗
 * @param {string} title - 標題
 * @param {string} message - 內容
 * @param {string} url - 點擊跳轉網址
 * @param {string} type - 'admin'(橘色) 或 'user'(綠色)
 */
function showNotificationPopup(title, message, url, type = 'admin') {
    // 1. 播放音效
    alertAudio.play().catch(() => console.log("等待互動以播放音效"));

    // 2. 建立 DOM
    const toast = document.createElement("div");
    // 根據 type 加入不同的 class (admin 或 user-update)
    toast.className = `custom-notification ${type === 'user' ? 'user-update' : 'admin-update'}`;
    
    toast.innerHTML = `
        <div class="notification-title">${title}</div>
        <div class="notification-body">${message}</div>
        <div class="notification-hint">點擊立刻前往處理 ➔</div>
    `;

    // 3. 點擊事件：跳轉到對應頁面
    toast.onclick = () => {
        window.location.href = url;
    };

    // 4. 加入頁面
    document.body.appendChild(toast);

    // 5. 6秒後自動消失
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

    // --- A. 管理員邏輯 (監聽新訂單) ---
    if (userRole === "admin" || userRole === "sub-admin") {
        const adminChannel = pusher.subscribe('admin-channel');
        
        adminChannel.bind('new-order', function(data) {
            // 排除自己下的測試單 (避免自己下單自己跳管理通知)
            if (data.username !== currentUser) {
                showNotificationDot("/admin/orders");
                
                // 橘色邊框彈窗 (管理員用)
                showNotificationPopup(
                    "🚨 新訂單通知", 
                    `來自 <b>${data.username}</b> 的新訂單<br>單號：#${data.order_id}<br>金額：$${data.total}`,
                    "/admin/orders",
                    'admin' 
                );

                // 如果正在管理接單頁，自動刷新
                if (typeof fetchOrders === "function") fetchOrders();
            }
        });
    }

    // --- B. 使用者邏輯 (監聽自己的訂單狀態更新) ---
    const userChannel = pusher.subscribe(`user-${currentUser}`);
    
    userChannel.bind('order-update', function(data) {
        showNotificationDot("orders-btn");

        // 綠色邊框彈窗 (一般使用者用)
        showNotificationPopup(
            "🍳 餐點進度更新", 
            `訂單 <b>#${data.order_id}</b><br>最新狀態：<span style="color:#2e7d32; font-weight:bold;">${data.status}</span>`,
            "/orders",
            'user'
        );

        // 如果正在訂單記錄頁，2秒後刷新
        if (window.location.pathname === "/orders") {
            setTimeout(() => location.reload(), 2000);
        }
    });
}

/**
 * 紅點提醒 (保持不變)
 */
function showNotificationDot(targetId) {
    document.getElementById("user-container")?.classList.add("notification-dot");
    const btn = document.querySelector(`button[data-url="${targetId}"]`) || document.getElementById(targetId);
    btn?.classList.add("notification-dot");
}

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