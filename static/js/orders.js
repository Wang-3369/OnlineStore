let currentOrderId = null;
let selectedRating = 0;

document.addEventListener("DOMContentLoaded", async () => {
    const orders = document.querySelectorAll(".order-block");

    for (const order of orders) {
        const orderId = order.querySelector(".review-btn")?.dataset.orderId;
        if (!orderId) continue;

        // 查詢是否已評論
        const res = await fetch("/api/reviews");
        const reviews = await res.json();
        const hasReviewed = reviews.some(r => r.order_id === orderId);
        if (hasReviewed) {
            const btn = order.querySelector(".review-btn");
            btn.textContent = "已評論";
            btn.disabled = true;
            btn.style.cursor = "not-allowed";
        }
    }
});


document.addEventListener("DOMContentLoaded", () => {

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

            // 塗色
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
    });

    // 取消評論
    document.getElementById("close-review").addEventListener("click", () => {
        document.getElementById("review-modal").style.display = "none";
    });
});
