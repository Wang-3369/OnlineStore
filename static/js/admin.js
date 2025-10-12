async function fetchProducts() {
    const res = await fetch("/api/products");
    const products = await res.json();
    const list = document.getElementById("product-list");
    list.innerHTML = "";
    products.forEach(p => {
        const div = document.createElement("div");
        div.innerHTML = `
            <strong>${p.name}</strong> - NT$ ${p.price} - 庫存: ${p.stock}
            <button onclick="deleteProduct('${p.id}')">刪除</button>
            <button onclick="editProduct('${p.id}', '${p.name}', ${p.price}, ${p.stock})">修改</button>
        `;
        list.appendChild(div);
    });
}

async function deleteProduct(id) {
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    fetchProducts();
}

function editProduct(id, oldName, oldPrice, oldStock) {
    const name = prompt("新商品名稱", oldName);
    const price = parseFloat(prompt("新價格", oldPrice));
    const stock = parseInt(prompt("新庫存", oldStock));
    
    if(name && !isNaN(price) && !isNaN(stock)) {
        fetch(`/api/products/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, price, stock })
        }).then(fetchProducts);
    } else {
        alert("價格和庫存必須為數字");
    }
}

document.getElementById("add-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    data.price = parseFloat(data.price);
    data.stock = parseInt(data.stock);
    if(isNaN(data.price) || isNaN(data.stock)){
        alert("價格和庫存必須為數字");
        return;
    }

    await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    e.target.reset();
    fetchProducts();
});

fetchProducts();