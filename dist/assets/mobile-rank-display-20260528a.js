function syncMobileRankNav() {
  if (!location.pathname.startsWith("/mobile")) return;
  const tabs = document.querySelectorAll(".mobile-frame-tabs a");
  tabs.forEach((tab) => {
    const href = tab.getAttribute("href") || "";
    const active = location.pathname.startsWith("/mobile/rank")
      ? href === "/mobile/rank"
      : location.pathname.startsWith("/chat")
        ? href === "/chat"
        : href === "/mobile";
    tab.classList.toggle("active", active);
  });
}

function trimMobileRankChrome() {
  if (!location.pathname.startsWith("/mobile/rank")) return;
  document.querySelector(".mobile-frame-composer")?.remove();
}

document.addEventListener("DOMContentLoaded", () => {
  syncMobileRankNav();
  trimMobileRankChrome();
});

setTimeout(() => {
  syncMobileRankNav();
  trimMobileRankChrome();
}, 350);

addEventListener("popstate", syncMobileRankNav);
