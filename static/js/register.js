document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    
    const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    const result = await res.json();
    if(res.ok){
        alert(result.message || "註冊成功");
        location.href = "/login";
    } else {
        alert(result.message || "註冊失敗");
    }
});
