let categories = [];   // 將由商品資料決定分類順序

// 渲染左側分類按鈕（依商品分類順序）
function renderCategoryButtons() {
    const container = document.getElementById("category-list");
    container.innerHTML = "";

    categories.forEach(c => {
        const btn = document.createElement("button");
        btn.innerText = c;
        btn.onclick = () => scrollToCategory(c);
        container.appendChild(btn);
    });
}

// 滾動到對應分類
function scrollToCategory(cat) {
    const el = document.getElementById(`category-${cat}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

// 取得商品
async function fetchProducts() {
    const container = document.getElementById("product-list-container");
    container.innerHTML = "";

    try {
        const res = await fetch("/api/products");
        const products = await res.json();

        // 按分類分組 + 記錄分類順序
        const grouped = {};
        categories = [];  // 重新開始由商品決定分類順序

        products.forEach(p => {
            const cat = p.category || "其他";
            if (!grouped[cat]) {
                grouped[cat] = [];
                categories.push(cat);     // ← 記錄分類順序
            }
            grouped[cat].push(p);
        });

        // 渲染分類按鈕（依商品分類順序）
        renderCategoryButtons();

        // 渲染商品區塊
        for (const cat of categories) {
            const section = document.createElement("div");
            section.classList.add("product-category");
            section.id = `category-${cat}`;

            const h3 = document.createElement("h3");
            h3.innerText = cat;
            section.appendChild(h3);

            const gridContainer = document.createElement("div");
            gridContainer.classList.add("product-list");

            grouped[cat].forEach(p => {
                const imgUrl = p.image_id
                    ? `/api/products/image/${p.image_id}`
                    : "/static/images/no-image.png";

                const card = document.createElement("div");
                card.className = "product-card";

                // 判斷是否已收藏
                const favClass = p.isFavorite ? 'added' : '';
                const favText = p.isFavorite ? '取消收藏' : '收藏';

                card.innerHTML = `
                    <a href="/description/${p.id}">
                        <img src="${imgUrl}" alt="${p.name}">
                        <h3>${p.name}</h3>
                    </a>
                    <p>NT$ ${p.price}</p>
                    <p>庫存：${p.stock}</p>
                    <label>數量：
                        <input type="number" value="1" min="1" max="${p.stock}" id="qty-${p.id}">
                    </label>
                    <button class="add-cart-btn"
                        data-id="${p.id}"
                        data-name="${p.name}"
                        data-price="${p.price}"
                        data-image="${imgUrl}">
                        加入購物車
                    </button>
                    <button class="fav-btn ${favClass}" data-id="${p.id}">${favText}</button>
                `;
                gridContainer.appendChild(card);
            });
            section.appendChild(gridContainer);
            container.appendChild(section);
        }

        bindAddCartButtons();
        bindFavoriteButtons();
    } catch (e) {
        console.error("抓商品失敗", e);
    }
}

document.getElementById("product-search")?.addEventListener("input", (e) => {
    const keyword = e.target.value.toLowerCase();
    const cards = document.querySelectorAll(".product-card");
    const categories = document.querySelectorAll(".product-category");

    cards.forEach(card => {
        const name = card.querySelector("h3").innerText.toLowerCase();
        card.style.display = name.includes(keyword) ? "block" : "none";
    });

    // 進階優化：如果某分類下的所有商品都被隱藏，則隱藏該分類標題
    categories.forEach(cat => {
        const visibleProducts = cat.querySelectorAll(".product-card[style='display: block;']");
        const allCards = cat.querySelectorAll(".product-card");
        let hasVisible = false;
        allCards.forEach(c => {
            if (c.style.display !== 'none') hasVisible = true;
        });
        cat.style.display = hasVisible ? "block" : "none";
    });
});

// 綁定加入購物車
function bindAddCartButtons() {
    document.querySelectorAll(".add-cart-btn").forEach(btn => {
        btn.onclick = async () => {
            const productId = btn.dataset.id;
            const qty = parseInt(document.getElementById(`qty-${productId}`).value) || 1;
            const res = await fetch("/api/cart/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_id: productId,
                    quantity: qty,
                    name: btn.dataset.name,
                    price: parseFloat(btn.dataset.price),
                    image: btn.dataset.image
                })
            });
            const result = await res.json();
            alert(result.message || "已加入購物車");
        };
    });
}

// 滾動時高亮分類
window.addEventListener("scroll", () => {
    const sidebarBtns = document.querySelectorAll("#category-list button");
    const scrollCenter = window.innerHeight / 2 + window.scrollY;

    sidebarBtns.forEach(btn => {
        const cat = btn.innerText;
        const section = document.getElementById(`category-${cat}`);
        if (section) {
            const rect = section.getBoundingClientRect();
            const top = rect.top + window.scrollY;
            const bottom = top + rect.height;

            if (scrollCenter >= top && scrollCenter <= bottom) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        }
    });
});

// 調整左側分類高度
function adjustSidebarHeight() {
    const firstCategory = document.querySelector('.product-category');
    const sidebar = document.querySelector('.category-sidebar');
    if (firstCategory && sidebar) {
        const rect = firstCategory.getBoundingClientRect();
        sidebar.style.maxHeight = rect.height + 'px';
    }
}

window.addEventListener("resize", adjustSidebarHeight);
window.addEventListener("load", adjustSidebarHeight);

// 初始化
async function init() {
    await fetchProducts();   // 只需抓商品，分類由商品決定
    adjustSidebarHeight();
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", adjustSidebarHeight);

// 綁定收藏
function bindFavoriteButtons() {
    document.querySelectorAll(".fav-btn").forEach(btn => {
        btn.onclick = async () => {
            const productId = btn.dataset.id;
            const action = btn.classList.contains("added") ? "remove" : "add";

            try {
                const res = await fetch(`/api/favorites/${action}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ product_id: productId })
                });
                const data = await res.json();
                if (res.ok) {
                    btn.classList.toggle("added");
                    btn.innerText = btn.classList.contains("added") ? '取消收藏' : '收藏';
                } else {
                    alert(data.message);
                }
            } catch (err) {
                console.error("收藏失敗", err);
            }
        };
    });
}
