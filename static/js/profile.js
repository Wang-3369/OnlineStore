document.addEventListener("DOMContentLoaded", () => {
    const avatarInput = document.getElementById("avatar-input");
    const cropModal = document.getElementById("crop-modal");
    const imageToCrop = document.getElementById("image-to-crop");
    const cropBtn = document.getElementById("crop-upload-btn");
    const cancelBtn = document.getElementById("crop-cancel-btn");
    let cropper = null;

    // ===== 1. 當使用者選擇檔案時 (啟動裁切) =====
    if (avatarInput) {
        avatarInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                imageToCrop.src = event.target.result;
                cropModal.style.display = "flex";

                if (cropper) {
                    cropper.destroy();
                }

                // 初始化 Cropper.js
                cropper = new Cropper(imageToCrop, {
                    aspectRatio: 1,      // 1:1 正方形裁切
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 0.8,
                    restore: false,
                    guides: true,
                    center: true,
                    highlight: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: false,
                });
            };
            reader.readAsDataURL(file);
            
            e.target.value = ''; // 重置 input 讓同一張圖可以重複選
        });
    }

    // ===== 2. 取消裁切 =====
    if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
            cropModal.style.display = "none";
            if (cropper) cropper.destroy();
        });
    }

    // ===== 3. 確認裁切並上傳 =====
    if (cropBtn) {
        cropBtn.addEventListener("click", () => {
            if (!cropper) return;

            cropper.getCroppedCanvas({
                width: 300,
                height: 300,
                fillColor: '#fff',
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high',
            }).toBlob(async (blob) => {
                const formData = new FormData();
                formData.append("avatar", blob, "avatar.jpg");

                try {
                    cropBtn.textContent = "上傳中...";
                    cropBtn.disabled = true;

                    const res = await fetch("/api/profile/avatar", {
                        method: "POST",
                        body: formData
                    });
                    const data = await res.json();

                    alert(data.message);
                    if (res.ok) {
                        location.reload();
                    } else {
                        cropBtn.textContent = "確認裁切並上傳";
                        cropBtn.disabled = false;
                    }
                } catch (err) {
                    console.error("上傳失敗", err);
                    alert("上傳發生錯誤");
                    cropBtn.textContent = "確認裁切並上傳";
                    cropBtn.disabled = false;
                }
            }, 'image/jpeg', 0.9);
        });
    }

    // ===== 4. 變更密碼 =====
    const changePwBtn = document.getElementById("change-password");
    if(changePwBtn) {
        changePwBtn.onclick = async () => {
            const old_pw = document.getElementById("old-password").value;
            const new_pw = document.getElementById("new-password").value;

            if (!old_pw || !new_pw) return alert("請填寫舊密碼與新密碼");

            const res = await fetch("/api/profile/change_password", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({old_password: old_pw, new_password: new_pw})
            });
            const data = await res.json();
            alert(data.message);
        };
    }

    // ===== 5. 刪除自訂頭像 =====
    const deleteBtn = document.getElementById("delete-avatar");
    if (deleteBtn) {
        deleteBtn.onclick = async () => {
            if (!confirm("確定要刪除自訂頭像嗎？")) return;

            const res = await fetch("/api/profile/delete_avatar", { method: "POST" });
            const data = await res.json();
            alert(data.message);

            if (res.ok) {
                window.location.reload();
            }
        };
    }

    // ===== 6. 修改 Email 邏輯 =====
    const changeEmailBtn = document.getElementById("change-email");
    if (changeEmailBtn) {
        changeEmailBtn.onclick = async () => {
            const newEmail = document.getElementById("new-email").value;

            if (!newEmail) return alert("請輸入 Email");

            const res = await fetch("/api/profile/change_email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: newEmail })
            });

            const data = await res.json();
            alert(data.message);

            if (res.ok) {
                // 更新畫面上顯示的 Email
                const emailSpan = document.getElementById("current-email");
                if (emailSpan) emailSpan.textContent = newEmail;
                document.getElementById("new-email").value = "";
            }
        };
    }
});