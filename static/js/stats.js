// 全域圖表變數
let barChart, lineChart, pieChart;
let barMode = "product"; // 預設長條圖模式：product 或 date

// ===== 生成查詢參數 =====
function getQueryParams() {
    const includePending = document.getElementById("includePending")?.checked;
    const start = document.getElementById("startDate")?.value || "";
    const end = document.getElementById("endDate")?.value || "";
    let params = [];
    if(includePending) params.push("include_pending=true");
    if(start) params.push("start=" + start);
    if(end) params.push("end=" + end);
    return params.length ? "?" + params.join("&") : "";
}

// ===== 處理日期群組多商品資料 =====
function processSalesData(orders) {
    const grouped = {}; // { date: { productName: totalQuantity } }

    orders.forEach(order => {
        const date = order.created_at.slice(0, 10); // yyyy-mm-dd
        if (!grouped[date]) grouped[date] = {};

        Object.values(order.products).forEach(p => {
            if (!grouped[date][p.name]) grouped[date][p.name] = 0;
            grouped[date][p.name] += p.quantity;
        });
    });

    const labels = Object.keys(grouped).sort();
    const allProducts = new Set();
    Object.values(grouped).forEach(d => Object.keys(d).forEach(p => allProducts.add(p)));

    const datasets = Array.from(allProducts).map((product, i) => ({
        label: product,
        data: labels.map(date => grouped[date][product] || 0),
        backgroundColor: `hsl(${(i*60)%360},70%,50%)`
    }));

    return { labels, datasets };
}

// ===== 顯示圖表 =====
function showChart(type) {
    // 切換顯示
    const charts = ["barChart", "lineChart", "pieChart"];
    charts.forEach(c => {
        document.getElementById(c).style.display = (c === type + "Chart") ? "block" : "none";
    });

    // 根據類型觸發載入
    if (type === 'line') loadLineChart();
    if (type === 'pie') loadPieChart();
}

// ===== 載入商品累計長條圖 =====
async function loadBarChartByProduct() {
    const res = await fetch("/api/stats/products" + getQueryParams());
    const data = await res.json();
    const labels = data.map(d => d.name);
    const quantities = data.map(d => d.quantity);

    const ctx = document.getElementById("barChart");
    if (barChart) barChart.destroy();
    barChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{ label: "銷售數量", data: quantities, backgroundColor: 'rgba(255,102,0,0.7)' }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero:true, title:{display:true,text:'銷售數量'} }
            }
        }
    });
}

// ===== 載入日期群組長條圖 =====
async function loadBarChartByDate() {
    const res = await fetch("/api/stats/orders_by_date_products" + getQueryParams());
    const data = await res.json();

    const labels = data.labels || [];
    const datasets = (data.datasets || []).map(d => ({
        label: d.name,
        data: d.quantities,
        backgroundColor: getRandomColor(),
    }));

    const ctx = document.getElementById("barChart");
    if (barChart) barChart.destroy();

    barChart = new Chart(ctx, {
        type: "bar",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                x: { title: { display: true, text: '日期' }, stacked: false },
                y: { title: { display: true, text: '銷售數量' }, beginAtZero: true, stacked: false }
            }
        }
    });
}

// ===== 生成隨機顏色 =====
function getRandomColor() {
    const r = Math.floor(Math.random() * 200);
    const g = Math.floor(Math.random() * 200);
    const b = Math.floor(Math.random() * 200);
    return `rgb(${r},${g},${b})`;
}


// ===== 切換長條圖模式的安全函數 =====
async function switchBarMode(mode) {
    showChart('bar');  // 顯示長條圖 canvas
    barMode = mode;
    if(barMode === "product") await loadBarChartByProduct();
    else await loadBarChartByDate();
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
        data: { labels, datasets: [{ label: "每日營收", data: values, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false }
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
        data: { labels, datasets: [{ label: "銷售占比", data: values }] },
        options: { responsive:true, maintainAspectRatio:false }
    });
}

// ===== 下載 CSV =====
function exportCSV() {
    const url = "/api/stats/export" + getQueryParams();
    window.open(url, "_blank");
}

// ===== DOM 載入完成後 =====
// ===== DOM 載入完成後 =====
document.addEventListener("DOMContentLoaded", () => {
    // 初始化
    updateAllStats();

    // 事件監聽整合
    document.getElementById("barByProductBtn").addEventListener("click", () => {
        barMode = "product";
        showChart('bar');
        loadBarChartByProduct();
    });

    document.getElementById("barByDateBtn").addEventListener("click", () => {
        barMode = "date";
        showChart('bar');
        loadBarChartByDate();
    });

    document.getElementById("filterDateBtn").addEventListener("click", updateAllStats);
    document.getElementById("includePending").addEventListener("change", updateAllStats);

    // 清理訂單按鈕
    const clearBtn = document.getElementById("clearOrdersBtn");
    if (clearBtn) {
        clearBtn.addEventListener("click", async () => {
            const type = document.getElementById("clearType").value;
            if (!confirm(`確定要刪除 "${type}" 的訂單嗎？此操作不可復原！`)) return;
            const res = await fetch("/api/stats/clear_orders", {
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body: JSON.stringify({type})
            });
            const data = await res.json();
            document.getElementById("clearResult").innerText = `已刪除 ${data.deleted_count} 筆訂單`;
            switchBarMode(barMode);
            loadLineChart();
            loadPieChart();
        });
    }

   refreshRevenue();
        
});

// ===== 載入所有數據的總發動機 =====
// ===== 載入所有數據的總發動機 (修正版) =====
async function updateAllStats() {
    // 1. 先更新上方數據卡片 (這是共用的)
    await refreshRevenue();

    // 2. 判斷目前哪種圖表的 Canvas 是顯示狀態 (display !== "none")，只更新該圖表
    const isBarVisible = document.getElementById("barChart").style.display !== "none";
    const isLineVisible = document.getElementById("lineChart").style.display !== "none";
    const isPieVisible = document.getElementById("pieChart").style.display !== "none";

    // 只有在長條圖顯示時，才根據 barMode 更新長條圖
    if (isBarVisible) {
        if (barMode === "product") {
            await loadBarChartByProduct();
        } else {
            await loadBarChartByDate();
        }
    }

    // 只有在折線圖顯示時，才更新折線圖
    if (isLineVisible) {
        await loadLineChart();
    }

    // 只有在圓餅圖顯示時，才更新圓餅圖
    if (isPieVisible) {
        await loadPieChart();
    }
}

// ===== 更新營業額卡片 =====
// 修改 stats.js 中的 refreshRevenue
async function refreshRevenue() {
    try {
        const queryParams = getQueryParams();
        
        // 呼叫我們新寫的 summary API
        const response = await fetch("/api/stats/summary" + queryParams);
        const data = await response.json();
        
        // 更新「總營業額」卡片
        const revEl = document.getElementById("totalRevenue");
        if(revEl) revEl.textContent = data.total_revenue.toLocaleString();
        
        // 更新「篩選範圍內訂單數」卡片 
        const countEl = document.getElementById("filteredOrderCount");
        if(countEl) countEl.textContent = data.order_count.toLocaleString();

    } catch (err) {
        console.error("更新數據卡片失敗", err);
    }
}
