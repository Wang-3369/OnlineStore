document.addEventListener("DOMContentLoaded", () => {
    const icon = document.getElementById('user-icon');
    const popup = document.getElementById('user-popup');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const adminBtn = document.getElementById('admin-btn');

    // 點擊圖示切換 popup
    icon.addEventListener('click', () => {
        popup.classList.toggle('show');
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

    // 點擊空白處收起 popup
    document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && e.target !== icon) {
            popup.classList.remove('show');
        }
    });
});
