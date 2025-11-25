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
    document.getElementById("barChart").style.display = type === "bar" ? "block" : "none";
    document.getElementById("lineChart").style.display = type === "line" ? "block" : "none";
    document.getElementById("pieChart").style.display = type === "pie" ? "block" : "none";
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
document.addEventListener("DOMContentLoaded", () => {
    // 長條圖模式按鈕
    document.getElementById("barByProductBtn").addEventListener("click", () => switchBarMode("product"));
    document.getElementById("barByDateBtn").addEventListener("click", () => switchBarMode("date"));

    // 預設載入長條圖、折線圖、圓餅圖
    switchBarMode("product");
    loadLineChart();
    loadPieChart();

    // 日期篩選按鈕
    const filterBtn = document.getElementById("filterDateBtn");
    filterBtn.addEventListener("click", () => {
        switchBarMode(barMode);
        loadLineChart();
        loadPieChart();
    });

    // checkbox 開關
    const includePending = document.getElementById("includePending");
    if (includePending) includePending.addEventListener("change", () => {
        switchBarMode(barMode);
        loadLineChart();
        loadPieChart();
    });

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

//營業額
async function refreshRevenue() {
    try {
        const response = await fetch("/api/orders");
        if (!response.ok) throw new Error("抓資料失敗：" + response.status);

        const data = await response.json();
        const orders = data.orders || [];

        let revenue = 0;
        orders.forEach(order => {
            revenue += order.total;
        });
        document.getElementById("totalRevenue").textContent = revenue;

    } catch (err) {
        console.error(err);
        document.getElementById("totalRevenue").textContent = 0;
    }
}
