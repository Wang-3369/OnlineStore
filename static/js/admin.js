async function fetchProducts() {
    const res = await fetch("/api/products");
    const products = await res.json();
    const list = document.getElementById("product-list");
    list.innerHTML = "";

    products.forEach(p => {
        const imgUrl = p.image_id ? `/api/products/image/${p.image_id}` : "/static/images/no-image.png";
        const div = document.createElement("div");
        div.innerHTML = `
            <img src="${imgUrl}" alt="${p.name}" style="width:80px;height:80px;object-fit:cover;margin-right:10px;">
            <strong>${p.name}</strong> - NT$ ${p.price} - 庫存: ${p.stock}
            <button onclick="deleteProduct('${p.id}')">刪除</button>
            <button onclick="editProduct('${p.id}', '${p.name}', ${p.price}, ${p.stock}, '${imgUrl}')">修改</button>
            <br><br>
        `;
        list.appendChild(div);
    });
}

async function deleteProduct(id) {
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    fetchProducts();
}

function editProduct(id, oldName, oldPrice, oldStock, oldImage) {
    const name = prompt("新商品名稱", oldName);
    const price = parseFloat(prompt("新價格", oldPrice));
    const stock = parseInt(prompt("新庫存", oldStock));

    if (!name || isNaN(price) || isNaN(stock)) {
        alert("名稱、價格或庫存格式錯誤");
        return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("price", price);
    formData.append("stock", stock);

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.onchange = async () => {
        if(fileInput.files.length > 0) formData.append("image", fileInput.files[0]);
        await fetch(`/api/products/${id}`, { method: "PUT", body: formData });
        fetchProducts();
    };
    fileInput.click();
}

document.getElementById("add-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target); // 包含 file
    await fetch("/api/products", { method: "POST", body: formData });
    e.target.reset();
    fetchProducts();
});

fetchProducts();
