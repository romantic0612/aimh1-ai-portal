function syncMobileViewportHeight() {
  const viewport = window.visualViewport;
  const innerHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
  const visualHeight = Math.round(viewport?.height || innerHeight);
  const keyboardInset = Math.max(0, innerHeight - visualHeight - Math.round(viewport?.offsetTop || 0));
  const keyboardOpen = keyboardInset > 90;
  const height = keyboardOpen ? innerHeight : visualHeight;
  if (height > 0) document.documentElement.style.setProperty("--mobile-vh", `${height}px`);
  document.documentElement.style.setProperty("--mobile-keyboard-inset", `${keyboardOpen ? keyboardInset : 0}px`);
  document.documentElement.classList.toggle("mobile-keyboard-open", keyboardOpen);
}

syncMobileViewportHeight();
window.visualViewport?.addEventListener("resize", syncMobileViewportHeight);
window.visualViewport?.addEventListener("scroll", syncMobileViewportHeight);
window.addEventListener("resize", syncMobileViewportHeight);
window.addEventListener("orientationchange", () => setTimeout(syncMobileViewportHeight, 250));
document.addEventListener("DOMContentLoaded", syncMobileViewportHeight);
