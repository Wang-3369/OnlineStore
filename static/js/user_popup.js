document.addEventListener("DOMContentLoaded", () => {
    const userIcon = document.getElementById('user-icon');
    const userMenu = document.getElementById('user-slide-menu');

    // 1. 切換選單顯示
    userIcon.addEventListener('click', (e) => {
        userMenu.classList.toggle('show');
        
        // 增加圖示點擊縮放反饋
        userIcon.style.transform = "scale(0.9)";
        setTimeout(() => userIcon.style.transform = "", 150);
        
        e.stopPropagation(); 
    });

    // 2. 點擊外部自動收起
    document.addEventListener('click', (e) => {
        if (!userMenu.contains(e.target) && e.target !== userIcon) {
            userMenu.classList.remove('show');
        }
    });

    // 3. 通用導航跳轉 (避免重複寫多個 Listener)
    const navigate = (id, url) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => location.href = url);
    };

    navigate('login-btn', '/login');
    navigate('orders-btn', '/orders');
    navigate('profile-btn', '/profile');
    navigate('favorites-btn', '/favorites');

    // 4. 管理者按鈕跳轉
    document.querySelectorAll(".admin-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            if (btn.dataset.url) location.href = btn.dataset.url;
        });
    });

    // 5. 登出邏輯
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            logoutBtn.textContent = "處理中...";
            const res = await fetch("/api/logout", { method: "POST" });
            if (res.ok) location.href = "/";
        });
    }
});