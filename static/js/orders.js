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

    // 4. 星星評分邏輯
    document.querySelectorAll("#star-rating span").forEach(star => {
        star.addEventListener("click", () => {
            selectedRating = parseInt(star.dataset.star);
            const stars = document.querySelectorAll("#star-rating span");
            stars.forEach(s => s.classList.remove("selected"));
            for (let i = 0; i < selectedRating; i++) {
                stars[i].classList.add("selected");
            }
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

// --- SSE 即時訂單狀態更新 ---
const evtSource = new EventSource("/events");

evtSource.addEventListener("order_update", function(e) {
    const data = JSON.parse(e.data);
    
    // 從 HTML 的隱藏欄位或 body data 屬性取得目前使用者名稱
    // 建議在 HTML 中加上 <body data-username="{{ session.get('username') }}">
    const currentUser = document.body.dataset.username;

    if (data.username === currentUser) {
        // 跳出通知
        alert(`您的訂單 ${data.order_id} 狀態已更新為：${data.status}`);
        
        // 為了確保畫面上所有資料（包含庫存、評論按鈕等）正確，採取重整策略
        location.reload(); 
    }
});