document.addEventListener("DOMContentLoaded", async () => {
    const slider = document.getElementById("promo-slider");
    const dotsContainer = document.getElementById("dots");

    // 從後端抓促銷圖片
    const res = await fetch("/api/promotions");
    const promotions = await res.json();
    if (!promotions.length) return;

    // 插入圖片
    promotions.forEach((p, idx) => {
        const img = document.createElement("img");
        img.src = `/api/promotions/image/${p.image_id}`;
        img.alt = "促銷圖片";
        slider.appendChild(img);

        // 圓點
        const dot = document.createElement("span");
        if(idx===0) dot.classList.add("active");
        dot.addEventListener("click", () => { goToSlide(idx); resetInterval(); });
        dotsContainer.appendChild(dot);
    });

    let index = 0;
    const total = promotions.length;
    const dots = dotsContainer.querySelectorAll("span");

    function showSlide(idx) {
        slider.style.transform = `translateX(-${idx * 100}%)`;
        dots.forEach(d => d.classList.remove("active"));
        dots[idx].classList.add("active");
    }

    function nextSlide() { index = (index + 1) % total; showSlide(index); }
    function prevSlide() { index = (index - 1 + total) % total; showSlide(index); }
    function goToSlide(idx) { index = idx; showSlide(index); }

    // 自動播放
    let interval = setInterval(nextSlide, 3000);
    function resetInterval() {
        clearInterval(interval);
        interval = setInterval(nextSlide, 3000);
    }

    // 左右箭頭事件
    document.querySelector(".prev").addEventListener("click", () => { prevSlide(); resetInterval(); });
    document.querySelector(".next").addEventListener("click", () => { nextSlide(); resetInterval(); });
});
