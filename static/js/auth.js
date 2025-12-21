// 處理登入邏輯
const loginForm = document.getElementById("login-form");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const result = await res.json();
        if (res.ok) {
            alert(result.message || "登入成功");
            location.href = "/";
        } else {
            alert(result.message || "登入失敗");
        }
    });
}

// --- 註冊邏輯與密碼檢測 ---
const registerForm = document.getElementById("register-form");
const passwordInput = document.getElementById("register-password");
const confirmInput = document.getElementById("confirm-password");
const feedback = document.getElementById("password-strength-feedback");

// 1. 即時密碼強度檢測
if (passwordInput) {
    passwordInput.addEventListener("input", () => {
        const pwd = passwordInput.value;
        const pwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        
        if (pwd.length === 0) {
            feedback.innerText = "";
        } else if (pwdRegex.test(pwd)) {
            feedback.innerText = "● 密碼強度：高 (符合規範)";
            feedback.style.color = "#28a745"; // 綠色
        } else {
            feedback.innerText = "○ 需包含大小寫字母、數字與符號 (@$!%*?&)，且長度達 8 位";
            feedback.style.color = "#dc3545"; // 紅色
        }
    });
}

// 2. 處理註冊提交
if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        // A. 驗證密碼強度
        const pwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!pwdRegex.test(data.password)) {
            alert("密碼不符合規定：需包含大小寫字母、數字及特殊符號，且至少 8 位。");
            return;
        }

        // B. 驗證二次確認密碼是否一致
        if (data.password !== data.confirm_password) {
            alert("兩次輸入的密碼不一致！");
            confirmInput.style.borderColor = "red";
            return;
        }

        const res = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: data.username,
                password: data.password
            })
        });

        const result = await res.json();
        if (res.ok) {
            alert("註冊成功！請重新登入。");
            location.href = "/login";
        } else {
            alert(result.message || "註冊失敗");
        }
    });
}