document.addEventListener("DOMContentLoaded", () => {
    const orders = document.querySelectorAll(".order-block");
    
    orders.forEach(order => {
        const createdISO = order.dataset.createdAt;
        
        if (createdISO) {
            const date = new Date(createdISO);
            const localTimeString = date.toLocaleString();
            const timeSpan = order.querySelector(".order-time span");
            if (timeSpan) {
                timeSpan.textContent = localTimeString;
            }
        }
    });
});