document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("promo-items");
    const uploadForm = document.getElementById("upload-form");

    // 1. 初始化監聽：範圍切換與折扣類型提示
    document.getElementById("scope_type")?.addEventListener("change", handleScopeChange);
    document.querySelector('select[name="promo_type"]')?.addEventListener("change", (e) => {
        const hint = document.getElementById('promo-hint');
        if (!hint) return;
        hint.innerText = e.target.value === 'discount' ? 
            "提示：請輸入 0 到 1 之間的小數 (例如 0.9)" : "提示：請輸入欲扣除的整數金額";
    });

    // 2. 載入列表功能
    async function loadPromotions() {
        container.innerHTML = "載入中...";
        const res = await fetch("/api/promotions");
        const promotions = await res.json();
        container.innerHTML = "";

        promotions.forEach(p => {
            const typeText = p.promo_type === 'discount' ? '打折' : '折價';
            const valSuffix = p.promo_type === 'discount' ? '倍' : '元';
            let scopeText = p.scope_type === 'all' ? '全館' : (p.scope_type === 'category' ? `類別: ${p.scope_value}` : `特定商品`);

            const div = document.createElement("div");
            div.className = "promo-item";
            div.innerHTML = `
                <img src="/api/promotions/image/${p.image_id}">
                <div class="promo-info">
                    <h4>${p.title} <span class="badge">${scopeText}</span></h4>
                    <p>門檻：符合條件滿 ${p.threshold} 元 | 優惠：${typeText} ${p.promo_value}${valSuffix}</p>
                </div>
                <button data-id="${p._id}" class="delete-btn">刪除</button>`;
            container.appendChild(div);
        });
    }

    // 3. 刪除與上傳事件
    container.addEventListener("click", async (e) => {
        if (e.target.classList.contains("delete-btn")) {
            if (!confirm("確定刪除？")) return;
            await fetch(`/api/promotions/${e.target.dataset.id}`, { method: "DELETE" });
            loadPromotions();
        }
    });

    uploadForm?.addEventListener("submit", async (e) => {
        e.preventDefault(); // 先阻止表單預設跳轉行為

        // 1. 定位提交按鈕 (通常是最後一個按鈕或有 submit 類型的按鈕)
        const submitBtn = uploadForm.querySelector('button[type="submit"]');
        
        // 2. 進入「處理中」狀態
        const originalText = submitBtn.innerText; // 備份原始文字 (例如 "發布促銷活動")
        submitBtn.disabled = true;                // 禁用按鈕防止重複點擊
        submitBtn.innerText = "處理中...";         // 更改按鈕文字

        try {
            const res = await fetch("/api/promotions/upload", { 
                method: "POST", 
                body: new FormData(uploadForm) 
            });

            if (res.ok) {
                uploadForm.reset();     // 清空表單
                loadPromotions();      // 刷新列表
                // 重置範圍選單隱藏狀態
                document.getElementById("scope-value-container").style.display = "none";
            } else {
                const errorMsg = await res.text();
                alert("發布失敗：" + errorMsg);
            }
        } catch (error) {
            console.error("上傳錯誤:", error);
            alert("網路連線異常，請稍後再試");
        } finally {
            // 3. 無論成功或失敗，最後都「恢復」按鈕狀態
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
        }
    });

    loadPromotions();
});

// 4. 範圍連動選單邏輯 (核心修正)
async function handleScopeChange() {
    const type = document.getElementById("scope_type").value;
    const box = document.getElementById("scope-value-container");
    const select = document.getElementById("scope_value_select");

    if (type === "all") {
        box.style.display = "none";
        return;
    }

    box.style.display = "block";
    select.innerHTML = '<option>載入中...</option>';

    const apiPath = type === "category" ? "/api/admin/categories" : "/api/admin/products_list";
    const res = await fetch(apiPath);
    const data = await res.json();

    select.innerHTML = data.map(item => {
        // 如果是商品，value 存 ID，顯示名稱；如果是類別，兩者皆為名稱
        const val = type === "product" ? item._id : item;
        const text = type === "product" ? item.name : item;
        return `<option value="${val}">${text}</option>`;
    }).join('');
}