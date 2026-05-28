function syncMobileViewportHeight() {
  const viewport = window.visualViewport;
  const height = Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 0);
  if (height > 0) {
    document.documentElement.style.setProperty("--mobile-vh", `${height}px`);
  }
}

syncMobileViewportHeight();
window.visualViewport?.addEventListener("resize", syncMobileViewportHeight);
window.visualViewport?.addEventListener("scroll", syncMobileViewportHeight);
window.addEventListener("resize", syncMobileViewportHeight);
window.addEventListener("orientationchange", () => setTimeout(syncMobileViewportHeight, 250));
document.addEventListener("DOMContentLoaded", syncMobileViewportHeight);
