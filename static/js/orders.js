let currentOrderId = null;
let selectedRating = 0;

document.addEventListener("DOMContentLoaded", async () => {
    const orders = document.querySelectorAll(".order-block");

    // 1. 取得所有評論並渲染已評論狀態
    try {
        const res = await fetch("/api/reviews");
        const reviews = await res.json();

        for (const order of orders) {
            const btn = order.querySelector(".review-btn");
            const orderId = btn?.dataset.orderId;
            if (!orderId) continue;

            const review = reviews.find(r => r.order_id === orderId);
            if (review) {
                btn.textContent = "已評論";
                btn.disabled = true;
                btn.style.cursor = "not-allowed";

                // 如果有管理者回覆，顯示回覆內容
                if (review.reply) {
                    const userReview = order.querySelector(".user-review");
                    if (userReview) {
                        let replyDiv = document.createElement("div");
                        replyDiv.classList.add("review-reply");
                        replyDiv.innerHTML = `<strong>管理者回覆：</strong>${review.reply}`;
                        userReview.insertAdjacentElement('afterend', replyDiv);
                    }
                }
            }
        }
    } catch (err) {
        console.error("無法取得評論資料", err);
    }

    // 2. 顯示建立時間 (轉換 ISO 字串為本地時間)
    document.querySelectorAll(".order-block").forEach(order => {
        const createdISO = order.dataset.createdAt;
        if (createdISO) {
            const date = new Date(createdISO);
            const timeSpan = order.querySelector(".order-time span");
            if (timeSpan) timeSpan.textContent = date.toLocaleString();
        }
    });

    // 3. 評論彈窗控制
    document.querySelectorAll(".review-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            currentOrderId = btn.dataset.orderId;
            document.getElementById("review-modal").style.display = "block";
        });
    });

    // 4. 星星評分邏輯 (修正版)
    document.querySelectorAll("#star-rating span").forEach(star => {
        star.addEventListener("click", () => {
            // 取得點擊的星等 (5, 4, 3, 2, 1)
            selectedRating = parseInt(star.dataset.star);
            
            // 移除所有星星的選取狀態
            document.querySelectorAll("#star-rating span").forEach(s => s.classList.remove("selected"));
            
            // 只幫「被點擊的那一顆」加上 selected
            // 配合 CSS 的 .selected ~ span，左邊（代碼後方）的星星會自動變色
            star.classList.add("selected");
            
            console.log("已選取星等：", selectedRating);
        });
    });

    // 5. 送出評論
    document.getElementById("submit-review").addEventListener("click", async () => {
        const content = document.getElementById("review-text").value;

        if (selectedRating === 0) {
            alert("請選擇星等！");
            return;
        }

        const res = await fetch("/api/reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                order_id: currentOrderId,
                content: content,
                rating: selectedRating
            })
        });

        const data = await res.json();
        alert(data.message);

        // 重置 Modal
        selectedRating = 0;
        document.getElementById("review-text").value = "";
        document.getElementById("review-modal").style.display = "none";
        document.querySelectorAll("#star-rating span").forEach(s => s.classList.remove("selected"));

        // 更新按鈕狀態
        const btn = document.querySelector(`.review-btn[data-order-id="${currentOrderId}"]`);
        if (btn) {
            btn.textContent = "已評論";
            btn.disabled = true;
            btn.style.cursor = "not-allowed";
        }
    });

    // 6. 關閉彈窗
    document.getElementById("close-review").addEventListener("click", () => {
        document.getElementById("review-modal").style.display = "none";
    });
});

/* --- SSE 即時訂單狀態更新 ---
// orders.js 結尾修正版
const evtSource = new EventSource("/events");

evtSource.addEventListener("order_update", function(e) {
    console.log("--- 收到 SSE 更新通知 ---");
    const data = JSON.parse(e.data);
    
    // 取得目前的使用者名稱 (已確認為 '01257032')
    const currentUser = document.body.dataset.username;

    // 加上 .trim() 確保不會因為空格導致判斷失敗
    const isTargetUser = (data.username && data.username.trim() === currentUser.trim());

    console.log("收到的資料:", data);
    console.log("當前使用者:", currentUser);
    console.log("是否匹配:", isTargetUser);

    if (isTargetUser) {
        // 使用 setTimeout 確保 alert 有時間在頁面重整前被捕捉
        setTimeout(() => {
            alert(`您的訂單 ${data.order_id} 狀態已更新為：${data.status}`);
            console.log("Alert 已觸發，準備重整頁面...");
            location.reload(); 
        }, 200); // 延遲 200 毫秒
    } else {
        console.warn("收到的通知不屬於此使用者，忽略更新。");
    }
});*/