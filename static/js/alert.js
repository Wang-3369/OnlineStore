
    // --- 全域資源初始化 ---
    const alertAudio = new Audio("/static/audio/alert.mp3");

    document.addEventListener("DOMContentLoaded", () => {
        const currentUser = document.body.dataset.username;
        const userRole = document.body.dataset.role; 
        console.log("當前使用者身分:", userRole);
        if (!currentUser) return; 

        const globalSource = new EventSource("/events");

        // 輔助函式：顯示紅點 (增加目標參數)
        const showDot = (targetId) => {
            // 1. 先顯示外層頭像的紅點 (讓使用者知道有通知)
            document.getElementById("user-container")?.classList.add("notification-dot");
            
            // 2. 顯示選單內具體按鈕的紅點
            if (targetId) {
                const btn = document.querySelector(`button[data-url="${targetId}"]`) || document.getElementById(targetId);
                btn?.classList.add("notification-dot");
            }
        };

        // --- A. 監聽：訂單狀態更新 (個人下單 -> 點亮「查看訂單」) ---
        globalSource.addEventListener("order_update", function(e) {
            const data = JSON.parse(e.data);
            if (data.username && data.username.trim() === currentUser.trim()) {
                // 顯示頭像紅點 + 「查看訂單」按鈕紅點
                showDot("orders-btn");
                
                if (window.location.pathname === "/orders") {
                    alert(`您的訂單 ${data.order_id} 狀態已更新為：${data.status}`);
                    location.reload();
                } else {
                    alert(`[個人訂單通知] 您的訂單狀態已更新！`);
                }
            }
        });

        // --- B. 監聽：新訂單進來 (管理者接單 -> 點亮「接單系統」) ---
        globalSource.addEventListener("new_order", function(e) {
            if (userRole === "admin" || userRole === "sub-admin") {
                const data = JSON.parse(e.data);

                if (data.username !== currentUser) {
                    // 1. 顯示紅點引導
                    showDot("/admin/orders"); 

                    // 2. 嘗試播放聲音
                    const playAttempt = alertAudio.play();

                    if (playAttempt !== undefined) {
                        playAttempt.then(() => {
                            console.log("音效播放成功");
                        }).catch(error => {
                            console.log("自動播放被阻擋，將透過 alert 引導使用者互動");
                        });
                    }

                    // 3. 跳出警告視窗 (這會阻塞畫面，強制使用者點擊)
                    if (typeof fetchOrders === "function") {
                        // 如果在接單頁面，直接更新列表並提示
                        fetchOrders();
                        alert(`【新訂單通知】您有一筆新訂單！單號：#${data.order_id}`);
                    } else {
                        // 如果在其他頁面，單純提示
                        alert(`[店務通知] 有新訂單來了！單號：#${data.order_id}`);
                    }
                }
            }
        });

        // --- 點擊處理：移除紅點 ---
        // 1. 點擊頭像時，只移除「頭像外層」的紅點，保留選單內的紅點引導使用者點擊
        document.getElementById("user-icon")?.addEventListener("click", () => {
            document.getElementById("user-container")?.classList.remove("notification-dot");
        });

        // 2. 點擊特定按鈕時，移除該按鈕的紅點
        document.querySelectorAll(".notification-dot").forEach(el => {
            el.addEventListener("click", function() {
                this.classList.remove("notification-dot");
            });
        });
    });