// 全域圖表變數
let barChart, lineChart, pieChart;

// ===== 生成查詢參數 =====
function getQueryParams() {
    const includePending = document.getElementById("includePending").checked;
    return includePending ? "?include_pending=true" : "";
}

// ===== 顯示某個圖表 =====
function showChart(type) {
    document.getElementById("barChart").style.display = type === "bar" ? "block" : "none";
    document.getElementById("lineChart").style.display = type === "line" ? "block" : "none";
    document.getElementById("pieChart").style.display = type === "pie" ? "block" : "none";
}

// ===== 載入長條圖 =====
async function loadBarChart() {
    const res = await fetch("/api/stats/products" + getQueryParams());
    const data = await res.json();
    const labels = data.map(d => d.name);
    const quantities = data.map(d => d.quantity);

    const ctx = document.getElementById("barChart");
    if (barChart) barChart.destroy(); // 銷毀舊圖表
    barChart = new Chart(ctx, {
        type: "bar",
        data: { labels, datasets: [{ label: "銷售數量", data: quantities, borderWidth: 1 }] }
    });
}

// ===== 載入折線圖 =====
async function loadLineChart() {
    const res = await fetch("/api/stats/revenue" + getQueryParams());
    const data = await res.json();
    const labels = data.map(d => d.date);
    const values = data.map(d => d.revenue);

    const ctx = document.getElementById("lineChart");
    if (lineChart) lineChart.destroy();
    lineChart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets: [{ label: "每日營收", data: values, tension: 0.3 }] }
    });
}

// ===== 載入圓餅圖 =====
async function loadPieChart() {
    const res = await fetch("/api/stats/pie" + getQueryParams());
    const data = await res.json();
    const labels = data.map(d => d.name);
    const values = data.map(d => d.value);

    const ctx = document.getElementById("pieChart");
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(ctx, {
        type: "pie",
        data: { labels, datasets: [{ label: "銷售占比", data: values }] }
    });
}

// ===== 下載 CSV =====
function exportCSV() {
    const url = "/api/stats/export" + getQueryParams();
    window.open(url, "_blank");
}

// ===== DOM 加載完成後 =====
document.addEventListener("DOMContentLoaded", () => {
    // 初始化圖表
    loadBarChart();
    loadLineChart();
    loadPieChart();

    // 清理訂單按鈕
    const clearBtn = document.getElementById("clearOrdersBtn");
    if (clearBtn) {
        clearBtn.addEventListener("click", async () => {
            const type = document.getElementById("clearType").value;
            if (!confirm(`確定要刪除 "${type}" 的訂單嗎？此操作不可復原！`)) return;

            const res = await fetch("/api/stats/clear_orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type })
            });
            const data = await res.json();
            document.getElementById("clearResult").innerText = `已刪除 ${data.deleted_count} 筆訂單`;

            // 刷新圖表
            loadBarChart();
            loadLineChart();
            loadPieChart();
        });
    }

    // checkbox 開關
    const includePending = document.getElementById("includePending");
    if (includePending) {
        includePending.addEventListener("change", () => {
            loadBarChart();
            loadLineChart();
            loadPieChart();
        });
    }
});
