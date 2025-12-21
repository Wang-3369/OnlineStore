// --- 全域資源初始化 ---
const alertAudio = new Audio("/static/audio/alert.mp3");

/**
 * 封裝 SSE 連線邏輯，避免斷線時全網頁 reload 導致伺服器癱瘓
 */
function setupSSE() {
    const currentUser = document.body.dataset.username;
    const userRole = document.body.dataset.role;

    if (!currentUser) return;

    console.log("正在建立 SSE 連線...");
    const globalSource = new EventSource("/events");

    // 1. 處理心跳與一般訊息
    globalSource.onmessage = function(e) {
        if (e.data === "heartbeat") {
            console.log("SSE 心跳正常");
            return;
        }
    };

    // 2. 監聽：訂單狀態更新 (個人通知)
    globalSource.addEventListener("order_update", function(e) {
        try {
            const data = JSON.parse(e.data);
            if (data.username && data.username.trim() === currentUser.trim()) {
                showNotificationDot("orders-btn");

                if (window.location.pathname === "/orders") {
                    alert(`您的訂單 ${data.order_id} 狀態已更新為：${data.status}`);
                    location.reload();
                } else {
                    alert(`[個人訂單通知] 您的訂單狀態已更新！`);
                }
            }
        } catch (err) {
            console.error("解析 order_update 失敗", err);
        }
    });

    // 3. 監聽：新訂單 (管理者通知)
    globalSource.addEventListener("new_order", function(e) {
        if (userRole === "admin" || userRole === "sub-admin") {
            try {
                const data = JSON.parse(e.data);
                // 排除自己下的測試單通知
                if (data.username !== currentUser) {
                    showNotificationDot("/admin/orders");
                    
                    // 播放音效
                    alertAudio.play().catch(() => console.log("音效自動播放被瀏覽器阻擋"));

                    if (typeof fetchOrders === "function") {
                        fetchOrders(); // 如果在管理頁面就更新列表
                        alert(`【新訂單通知】您有一筆新訂單！單號：#${data.order_id}`);
                    } else {
                        alert(`[店務通知] 有新訂單來了！單號：#${data.order_id}`);
                    }
                }
            } catch (err) {
                console.error("解析 new_order 失敗", err);
            }
        }
    });

    // 4. 錯誤處理：連線斷開時不要 reload 頁面，而是重新連線 SSE
    globalSource.onerror = function() {
        console.warn("SSE 連線中斷，5秒後嘗試背景重連...");
        globalSource.close();
        setTimeout(setupSSE, 5000); // 治本：只重連線，不重整網頁
    };
}

/**
 * 顯示紅點提醒
 */
function showNotificationDot(targetId) {
    // 顯示頭像外層紅點
    document.getElementById("user-container")?.classList.add("notification-dot");
    
    // 顯示選單內按鈕紅點
    const btn = document.querySelector(`button[data-url="${targetId}"]`) || document.getElementById(targetId);
    btn?.classList.add("notification-dot");
}

/**
 * 頁面載入後初始化
 */
document.addEventListener("DOMContentLoaded", () => {
    // 啟動 SSE
    setupSSE();

    // 綁定點擊事件：移除紅點
    document.getElementById("user-icon")?.addEventListener("click", () => {
        document.getElementById("user-container")?.classList.remove("notification-dot");
    });

    // 委派點擊事件給所有紅點按鈕
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("notification-dot")) {
            e.target.classList.remove("notification-dot");
        }
    });
});