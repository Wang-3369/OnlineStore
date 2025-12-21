let currentOrderId = null;
let selectedRating = 0;

document.addEventListener("DOMContentLoaded", async () => {
    const orders = document.querySelectorAll(".order-block");

    // 取得所有評論
    const res = await fetch("/api/reviews");
    const reviews = await res.json();

    for (const order of orders) {
        const orderId = order.querySelector(".review-btn")?.dataset.orderId;
        if (!orderId) continue;

        const review = reviews.find(r => r.order_id === orderId);
        if (review) {
            const btn = order.querySelector(".review-btn");
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

    // 顯示建立時間
    document.querySelectorAll(".order-block").forEach(order => {
        const createdISO = order.dataset.createdAt;
        if (createdISO) {
            const date = new Date(createdISO);
            order.querySelector(".order-time span").textContent = date.toLocaleString();
        }
    });

    // 點擊 "留下評論"
    document.querySelectorAll(".review-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            currentOrderId = btn.dataset.orderId;
            document.getElementById("review-modal").style.display = "block";
        });
    });

    // 點擊星星
    document.querySelectorAll("#star-rating span").forEach(star => {
        star.addEventListener("click", () => {
            selectedRating = parseInt(star.dataset.star);

            document.querySelectorAll("#star-rating span").forEach(s => s.classList.remove("selected"));
            for (let i = 0; i < selectedRating; i++) {
                document.querySelectorAll("#star-rating span")[i].classList.add("selected");
            }
        });
    });

    // 送出評論
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

        // 重置
        selectedRating = 0;
        document.getElementById("review-text").value = "";
        document.getElementById("review-modal").style.display = "none";
        document.querySelectorAll("#star-rating span").forEach(s => s.classList.remove("selected"));

        // 更新該訂單區塊為已評論
        const btn = document.querySelector(`.review-btn[data-order-id="${currentOrderId}"]`);
        btn.textContent = "已評論";
        btn.disabled = true;
        btn.style.cursor = "not-allowed";
    });

    // 取消評論
    document.getElementById("close-review").addEventListener("click", () => {
        document.getElementById("review-modal").style.display = "none";
    });
});

// 每 30 秒自動重新載入頁面以更新訂單狀態
setInterval(() => {
    location.reload();
}, 30000);