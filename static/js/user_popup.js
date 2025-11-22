document.addEventListener("DOMContentLoaded", () => {
    const userContainer = document.getElementById('user-container');
    const userIcon = document.getElementById('user-icon');
    const userMenu = document.getElementById('user-slide-menu');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const adminBtn = document.getElementById('admin-btn');
    const orderBtn = document.getElementById('orders-btn');
    const profileBtn = document.getElementById('profile-btn');

    // 點擊圖示切換選單
    userIcon.addEventListener('click', (e) => {
        userMenu.classList.toggle('show');
        e.stopPropagation(); // 阻止冒泡，避免 document click 立即收起
    });

    // 點選外部關閉
    document.addEventListener('click', (e) => {
        if (!userMenu.contains(e.target) && e.target !== userIcon) {
            userMenu.classList.remove('show');
        }
    });


    // 點擊登入
    if (loginBtn) {
        loginBtn.addEventListener('click', () => location.href = "/login");
    }

    // 點擊登出
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const res = await fetch("/api/logout", { method: "POST" });
            if (res.ok) location.href = "/";
        });
    }

    // 點擊管理後台
    if (adminBtn) {
        adminBtn.addEventListener('click', () => location.href = "/admin/user");
    }

    if (orderBtn) {
        orderBtn.addEventListener('click', () => location.href = "/orders");
    }

    if (profileBtn) {
        profileBtn.addEventListener('click', () => location.href = "/profile");
    }
});
