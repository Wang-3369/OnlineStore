document.addEventListener("DOMContentLoaded", async () => {
    const reviewBox = document.getElementById("review-section");

    async function loadReviews() {
        const res = await fetch("/api/reviews");
        if (!res.ok) {
            reviewBox.innerHTML = "<p>無法載入評論</p>";
            return;
        }

        const reviews = await res.json();
        if (reviews.length === 0) {
            reviewBox.innerHTML = "<p>尚無評論</p>";
            return;
        }

        reviewBox.innerHTML = reviews.map(r => `
            <div class="review-item" data-id="${r._id}">
                <div class="review-header">
                    <strong>${r.username}</strong>
                    <span class="review-rating">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>
                </div>
                <p>${r.content}</p>
                ${r.reply ? `<p class="review-reply"><strong>管理者回覆：</strong>${r.reply}</p>` : ""}
                <small>${new Date(r.created_at).toLocaleString()}</small>
                ${r.can_delete ? `<button class="delete-btn">刪除</button>
                <button class="reply-btn">回覆</button>` : ""}
            </div>
        `).join("");

        // 刪除
        document.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const reviewId = btn.closest(".review-item").dataset.id;
                if (!confirm("確定要刪除這則評論嗎？")) return;
                const res = await fetch(`/api/reviews/${reviewId}`, { method: "DELETE" });
                const data = await res.json();
                alert(data.message);
                loadReviews();
            });
        });

        // 回覆
        document.querySelectorAll(".reply-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const reviewId = btn.closest(".review-item").dataset.id;
                const replyText = prompt("輸入回覆內容：");
                if (!replyText) return;
                const res = await fetch(`/api/reviews/${reviewId}/reply`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reply: replyText })
                });
                const data = await res.json();
                alert(data.message);
                loadReviews();
            });
        });
    }

    loadReviews();
});
