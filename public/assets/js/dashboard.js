document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("sidebar");
    const toggleBtn = document.getElementById("toggleSidebar");

    if (!sidebar || !toggleBtn) return;

    if (localStorage.getItem("sidebar") === "collapsed") {
        sidebar.classList.add("collapsed");
    }

    toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");

        localStorage.setItem(
            "sidebar",
            sidebar.classList.contains("collapsed")
                ? "collapsed"
                : "open"
        );
    });
});