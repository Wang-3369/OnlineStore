document.addEventListener("DOMContentLoaded", () => {
    const buttons = document.querySelectorAll(".add-cart-btn");

    buttons.forEach(btn => {
        btn.addEventListener("click", async () => {
            const productId = btn.dataset.id;
            const qtyInput = document.getElementById(`qty-${productId}`);
            const quantity = parseInt(qtyInput.value) || 1;

            const res = await fetch("/api/cart/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ product_id: productId, quantity })
            });

            const result = await res.json();
            alert(result.message || "已加入購物車");
        });
    });
});
