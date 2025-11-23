document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("promo-items");

    // 取得促銷圖片清單
    async function loadPromotions() {
        container.innerHTML = "";
        const res = await fetch("/api/promotions");
        const promotions = await res.json();

        promotions.forEach(p => {
            const div = document.createElement("div");
            div.className = "promo-item";

            div.innerHTML = `
                <img src="/api/promotions/image/${p.image_id}" alt="promotion">
                <button data-id="${p._id}" class="delete-btn">刪除</button>
            `;

            container.appendChild(div);
        });
    }

    await loadPromotions();

    // 刪除功能
    container.addEventListener("click", async (e) => {
        if (e.target.classList.contains("delete-btn")) {
            const id = e.target.dataset.id;
            if (!confirm("確定要刪除這張圖片？")) return;

            const res = await fetch(`/api/promotions/${id}`, { method: "DELETE" });
            const data = await res.json();
            alert(data.message);
            await loadPromotions();
        }
    });

    // 上傳功能
    const uploadForm = document.getElementById("upload-form");
    uploadForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(uploadForm);

        const res = await fetch("/api/promotions/upload", {
            method: "POST",
            body: formData
        });

        const data = await res.json();
        alert(data.message);
        if (res.ok) {
            uploadForm.reset();
            await loadPromotions();
        }
    });
});
