let categories = [];

async function fetchCategories() {
    try {
        const res = await fetch("/api/categories");
        categories = await res.json();
    } catch(e) {
        console.error("抓分類失敗", e);
        categories = ["其他"];
    }
    renderCategoryOptions();
}

function renderCategoryOptions() {
    const select = document.getElementById("categorySelect");
    if (!select) return;
    select.innerHTML = "";
    categories.forEach(c => {
        const option = document.createElement("option");
        option.value = c;
        option.innerText = c;
        select.appendChild(option);
    });
}

// 新增分類
document.addEventListener("DOMContentLoaded", () => {
    const addCatBtn = document.getElementById("addCategoryBtn");
    if(addCatBtn){
        addCatBtn.addEventListener("click", async () => {
            const newCat = document.getElementById("newCategory").value.trim();
            if (!newCat) return;

            await fetch("/api/categories", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({name: newCat})
            });

            document.getElementById("newCategory").value = "";
            await fetchCategories();
        });
    }

    init();
});

// 商品列表
async function fetchProducts() {
    try {
        const res = await fetch("/api/products");
        const products = await res.json();
        const list = document.getElementById("product-list");
        if(!list) return;
        list.innerHTML = "";

        products.forEach(p => {
            const imgUrl = p.image_id ? `/api/products/image/${p.image_id}` : "/static/images/no-image.png";
            const div = document.createElement("div");
            div.style.border = "1px solid #ccc";
            div.style.padding = "10px";
            div.style.marginBottom = "10px";

            div.innerHTML = `
                <img src="${imgUrl}" style="width:80px;height:80px;object-fit:cover;margin-right:10px;">
                <strong>${p.name}</strong> - NT$ ${p.price} - 庫存: ${p.stock} - 分類: ${p.category || "其他"}
                <button onclick="showEdit('${p.id}')">修改</button>
                <button onclick="deleteProduct('${p.id}')">刪除</button>
                <div id="edit-${p.id}" style="display:none; margin-top:10px;">
                    <input type="text" id="name-${p.id}" value="${p.name}">
                    <input type="number" id="price-${p.id}" value="${p.price}" step="0.01">
                    <input type="number" id="stock-${p.id}" value="${p.stock}" step="1">

                    <textarea id="desc-${p.id}" placeholder="餐點描述" style="width:100%;height:60px;">${p.description}</textarea>

                    <select id="category-${p.id}">
                        ${categories.map(c => `<option value="${c}" ${c===p.category?'selected':''}>${c}</option>`).join("")}
                    </select>
                    <input type="file" id="image-${p.id}">
                    <button onclick="updateProduct('${p.id}')">確認修改</button>
                    <button onclick="hideEdit('${p.id}')">取消</button>
                </div>
            `;
            list.appendChild(div);
        });
    } catch(e) {
        console.error("抓商品失敗", e);
    }
}

// 顯示/隱藏修改欄位
function showEdit(id) { document.getElementById(`edit-${id}`).style.display = "block"; }
function hideEdit(id) { document.getElementById(`edit-${id}`).style.display = "none"; }

// 修改商品
async function updateProduct(id) {
    const formData = new FormData();
    formData.append("name", document.getElementById(`name-${id}`).value);
    formData.append("price", document.getElementById(`price-${id}`).value);
    formData.append("stock", document.getElementById(`stock-${id}`).value);
    formData.append("category", document.getElementById(`category-${id}`).value);
    formData.append("description", document.getElementById(`desc-${id}`).value);
    const imageInput = document.getElementById(`image-${id}`);
    if(imageInput.files.length>0) formData.append("image", imageInput.files[0]);

    await fetch(`/api/products/${id}`, { method: "PUT", body: formData });
    fetchProducts();
}

// 刪除商品
async function deleteProduct(id) {
    if(!confirm("確定刪除商品？")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    fetchProducts();
}

// 新增商品
document.addEventListener("DOMContentLoaded", () => {
    const addForm = document.getElementById("add-form");
    if(addForm){
        addForm.addEventListener("submit", async e => {
            e.preventDefault();
            const formData = new FormData(e.target);
            if (!formData.get("category")) formData.set("category", "其他");
            await fetch("/api/products", { method: "POST", body: formData });
            e.target.reset();
            fetchProducts();
        });
    }
});

// 初始化
async function init() {
    await fetchCategories();
    await fetchProducts();
}
