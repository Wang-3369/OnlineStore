document.addEventListener("DOMContentLoaded", () => {
    const avatarInput = document.getElementById("avatar-input");
    const cropModal = document.getElementById("crop-modal");
    const imageToCrop = document.getElementById("image-to-crop");
    const cropBtn = document.getElementById("crop-upload-btn");
    const cancelBtn = document.getElementById("crop-cancel-btn");
    let cropper = null;

    // ===== 1. 當使用者選擇檔案時 =====
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

                // 初始化 Cropper
                cropper = new Cropper(imageToCrop, {
                    aspectRatio: 1,      // 限制裁切比例為 1:1 (正方形/圓形)
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
            
            e.target.value = ''; 
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


    const changePwBtn = document.getElementById("change-password");
    if(changePwBtn) {
        changePwBtn.onclick = async () => {
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
    }

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
});