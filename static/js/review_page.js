document.addEventListener("DOMContentLoaded", async () => {
    const reviewBox = document.getElementById("review-section");
    const sortSelect = document.getElementById("sort-select");
    let reviewsData = [];

    async function loadReviews() {
        const res = await fetch("/api/reviews");
        if (!res.ok) {
            reviewBox.innerHTML = "<p>無法載入評論</p>";
            return;
        }

        reviewsData = await res.json();
        if (reviewsData.length === 0) {
            reviewBox.innerHTML = "<p>尚無評論</p>";
            return;
        }

        renderReviews();
        renderRatingChart();
    }

    function renderReviews() {
        let sortedReviews = [...reviewsData];
        const sortVal = sortSelect.value;

        if (sortVal === "time-desc") sortedReviews.sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
        else if (sortVal === "time-asc") sortedReviews.sort((a,b)=> new Date(a.created_at) - new Date(b.created_at));
        else if (sortVal === "rating-desc") sortedReviews.sort((a,b)=> b.rating - a.rating);
        else if (sortVal === "rating-asc") sortedReviews.sort((a,b)=> a.rating - b.rating);

        reviewBox.innerHTML = sortedReviews.map(r => `
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

    // 星級統計圖
    function renderRatingChart() {
        const counts = [0,0,0,0,0];
        reviewsData.forEach(r => counts[r.rating - 1]++);
        const ctx = document.getElementById("rating-chart").getContext("2d");

        if (window.ratingChart) window.ratingChart.destroy();
        window.ratingChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['★1','★2','★3','★4','★5'],
                datasets: [{
                    label: '評論數量',
                    data: counts,
                    backgroundColor: '#f39c12'
                }]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });
    }

    sortSelect.addEventListener("change", renderReviews);

    loadReviews();
});
