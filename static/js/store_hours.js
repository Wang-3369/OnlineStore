function loadStoreHours() {
    fetch("/api/admin/store-hours/get")
        .then(r => r.json())
        .then(data => {
            document.getElementById("start_time").value = data.start;
            document.getElementById("end_time").value = data.end;
        });
}

function updateStoreHours() {
    const start = document.getElementById("start_time").value;
    const end = document.getElementById("end_time").value;

    fetch("/api/admin/store-hours/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end })
    })
    .then(r => r.json())
    .then(data => {
        document.getElementById("msg").innerText = data.message;
    });
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("update-btn").addEventListener("click", updateStoreHours);
    loadStoreHours();
});