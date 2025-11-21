const avatarImg = document.getElementById("avatar-img");

const uploadBtn = document.getElementById("upload-avatar");
if (uploadBtn) {
    uploadBtn.onclick = async () => {
        const file = document.getElementById("avatar-input").files[0];
        if (!file) return alert("請選擇檔案");

        const form = new FormData();
        form.append("avatar", file);

        const res = await fetch("/api/profile/avatar", { method: "POST", body: form });
        const data = await res.json();
        alert(data.message);

        if (res.ok) {
            // 上傳成功後直接刷新頁面
            location.reload();
        }
    };
}


document.getElementById("change-password").onclick = async () => {
    const old_pw = document.getElementById("old-password").value;
    const new_pw = document.getElementById("new-password").value;

    const res = await fetch("/api/profile/change_password", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({old_password: old_pw, new_password: new_pw})
    });
    const data = await res.json();
    alert(data.message);
};

const deleteBtn = document.getElementById("delete-avatar");
if (deleteBtn) {
    deleteBtn.onclick = async () => {
        if (!confirm("確定要刪除自訂頭像嗎？")) return;

        const res = await fetch("/api/profile/delete_avatar", { method: "POST" });
        const data = await res.json();
        alert(data.message);

        if (res.ok) {
            // 刪除後顯示 Google 頭像或預設圖片
            window.location.reload();
        }
    };
}

