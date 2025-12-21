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

        reviewBox.innerHTML = sortedReviews.map(r => {
            // --- 核心修正：在這裡處理每一條評論的時間 ---
            const date = new Date(r.created_at);
            const displayTime = date.toLocaleString('zh-TW', { 
                hour12: false, // 強制 24 小時制
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });

            return `
                <div class="review-item" data-id="${r._id}">
                    <div class="review-header">
                        <strong>${r.username}</strong>
                        <span class="review-rating">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>
                    </div>
                    <p>${r.content || "（無內容）"}</p>
                    ${r.reply ? `<p class="review-reply"><strong>管理者回覆：</strong>${r.reply}</p>` : ""}
                    <small>${displayTime}</small>  <div class="review-actions">
                        ${r.can_delete ? `
                            <button class="delete-btn">刪除</button>
                            <button class="reply-btn">回覆</button>
                        ` : ""}
                    </div>
                </div>
            `;
        }).join("");

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
    // 取得 1-5 星的數量
    const counts = [0, 0, 0, 0, 0];
    reviewsData.forEach(r => {
        if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1]++;
    });

    const ctx = document.getElementById("rating-chart").getContext("2d");

    if (window.ratingChart) window.ratingChart.destroy();
    
    window.ratingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            // 反轉標籤，讓 5 星排在最前面
            labels: ['5★', '4★', '3★', '2★', '1★'],
            datasets: [{
                label: '評論數量',
                data: [...counts].reverse(), // 數據也要跟著反轉
                backgroundColor: '#f1c40f', // 使用更有質感的金黃色
                borderRadius: 4,
                barThickness: 20 // 讓柱狀圖不要太粗，比較精緻
            }]
        },
        options: {
            indexAxis: 'y', // 改為橫向排列，更適合手機端閱讀
            responsive: true,
            maintainAspectRatio: false, // 允許自定義高度
            plugins: {
                legend: { display: false } // 隱藏上方圖例，節省空間
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }, // 數量顯示為整數
                    grid: { display: false } // 隱藏背景格線
                },
                y: {
                    grid: { display: false }
                }
            }
        }
    });
}

    sortSelect.addEventListener("change", renderReviews);

    loadReviews();
});
