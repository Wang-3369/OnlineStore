document.addEventListener("DOMContentLoaded", () => {
    const userContainer = document.getElementById('user-container');
    const userIcon = document.getElementById('user-icon');
    const userMenu = document.getElementById('user-slide-menu');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const orderBtn = document.getElementById('orders-btn');
    const profileBtn = document.getElementById('profile-btn');
    const favoritesBtn = document.getElementById("favorites-btn");

    // 點擊圖示切換選單
    userIcon.addEventListener('click', (e) => {
        userMenu.classList.toggle('show');
        e.stopPropagation(); 
    });

    // 點選外部收起選單
    document.addEventListener('click', (e) => {
        if (!userMenu.contains(e.target) && e.target !== userIcon) {
            userMenu.classList.remove('show');
        }
    });

    // 登入
    if (loginBtn) loginBtn.addEventListener('click', () => location.href = "/login");

    // 登出
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const res = await fetch("/api/logout", { method: "POST" });
            if (res.ok) location.href = "/";
        });
    }

    // 訂單 & 個人介面 & 收藏頁面
    if (orderBtn) orderBtn.addEventListener('click', () => location.href = "/orders");
    if (profileBtn) profileBtn.addEventListener('click', () => location.href = "/profile");
    if (favoritesBtn)favoritesBtn.addEventListener("click", () => location.href = "/favorites");

    // 管理者按鈕統一綁定
    document.querySelectorAll(".admin-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const url = btn.dataset.url;
            if (url) location.href = url;
        });
    });
});
