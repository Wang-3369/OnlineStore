function updateOrderTimes(timezone) {
    const orders = document.querySelectorAll(".order-block");
    orders.forEach(order => {
        const createdISO = order.dataset.createdAt;
        const date = new Date(createdISO);
        let formatted = "";

            // 解析 UTC+N
            const tzOffset = parseInt(timezone.replace("UTC", ""), 10); // 例如 "+8"
            const utcYear = date.getUTCFullYear();
            const utcMonth = date.getUTCMonth();
            const utcDay = date.getUTCDate();
            const utcHour = date.getUTCHours();
            const utcMinute = date.getUTCMinutes();
            const utcSecond = date.getUTCSeconds();

            let tzHour = utcHour + tzOffset;
            let dayOffset = 0;
            if(tzHour >= 24){
                tzHour -= 24;
                dayOffset = 1;
            } else if(tzHour < 0){
                tzHour += 24;
                dayOffset = -1;
            }

            const tzDate = new Date(Date.UTC(utcYear, utcMonth, utcDay + dayOffset, tzHour, utcMinute, utcSecond));

            formatted = tzDate.getFullYear() + "/" +
                        String(tzDate.getMonth() + 1).padStart(2, "0") + "/" +
                        String(tzDate.getDate()).padStart(2, "0") + " " +
                        String(tzDate.getHours()).padStart(2, "0") + ":" +
                        String(tzDate.getMinutes()).padStart(2, "0") + ":" +
                        String(tzDate.getSeconds()).padStart(2, "0") +
                        " " + timezone;

        order.querySelector(".order-time span").textContent = formatted;
    });
}

// 初始化
const tzSelect = document.getElementById("timezone-select");
updateOrderTimes(tzSelect.value);

// 切換時區
tzSelect.addEventListener("change", () => {
    updateOrderTimes(tzSelect.value);
});
