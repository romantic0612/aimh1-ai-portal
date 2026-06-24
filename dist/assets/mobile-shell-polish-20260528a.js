function mobileShellPath() {
  return location.pathname.replace(/\/+$/, "") || "/";
}

function isMobileShellViewport() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function syncResponsiveHomeRoute() {
  if (mobileShellPath() !== "/" || !isMobileShellViewport()) return;
  const target = new URL("/mobile", location.origin);
  target.search = location.search;
  target.hash = location.hash;
  location.replace(target.pathname + target.search + target.hash);
}

function syncMobileShellClasses() {
  const path = mobileShellPath();
  const mobileChat = path === "/chat" && isMobileShellViewport();
  document.documentElement.classList.toggle("mobile-chat-frame", mobileChat);
  document.documentElement.classList.toggle("mobile-rank", path === "/mobile/rank");
  document.documentElement.classList.toggle("mobile-home-frame", path === "/mobile");
  document.documentElement.classList.toggle("mobile-preview", path === "/mobile" || path === "/mobile/rank" || mobileChat);
}

function syncInjectedTopbar() {
  const path = mobileShellPath();
  const topbar = document.querySelector(".mobile-frame-topbar");
  if (!topbar || path === "/chat") return;

  topbar.classList.add("mobile-portal-topbar");
  const activeHref = path === "/mobile/rank" ? "/mobile/rank" : "/mobile";
  topbar.querySelectorAll(".mobile-frame-tabs a").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === activeHref);
  });

  if (!topbar.querySelector(".mobile-frame-brand")) {
    const brand = document.createElement("a");
    brand.className = "mobile-frame-brand";
    brand.href = "/mobile";
    brand.innerHTML = '<img src="/logo.png" alt=""><span><b>农芯智</b><small>v1.0</small></span>';
    topbar.querySelector(".mobile-frame-menu")?.replaceWith(brand);
  }

  topbar.querySelector(".mobile-frame-profile")?.remove();
  topbar.querySelector(".mobile-frame-new")?.remove();
}

function ensureMobileChatTopbar() {
  if (mobileShellPath() !== "/chat" || !isMobileShellViewport()) {
    document.querySelector(".mobile-chat-topbar")?.remove();
    document.querySelector(".mobile-chat-drawer-mask")?.remove();
    document.body.classList.remove("mobile-chat-history-open");
    return;
  }
  if (document.querySelector(".mobile-chat-topbar")) return;

  const bar = document.createElement("div");
  bar.className = "mobile-chat-topbar";
  bar.innerHTML = [
    '<button class="mobile-chat-history" type="button" aria-label="历史会话"><span></span><span></span></button>',
    '<a class="mobile-chat-brand" href="/mobile"><img src="/logo.png" alt=""><span>农芯智 AI</span></a>',
    '<button class="mobile-chat-new" type="button" aria-label="新对话">+</button>'
  ].join("");

  const mask = document.createElement("button");
  mask.className = "mobile-chat-drawer-mask";
  mask.type = "button";
  mask.setAttribute("aria-label", "关闭历史");

  document.body.append(bar, mask);
  bar.querySelector(".mobile-chat-history").addEventListener("click", () => {
    document.body.classList.add("mobile-chat-history-open");
  });
  mask.addEventListener("click", () => {
    document.body.classList.remove("mobile-chat-history-open");
  });
  bar.querySelector(".mobile-chat-new").addEventListener("click", () => {
    document.querySelector(".new-chat-btn")?.click();
    document.body.classList.remove("mobile-chat-history-open");
  });
  document.querySelector(".chat-sidebar")?.addEventListener("click", (event) => {
    if (event.target.closest(".history-item")) {
      document.body.classList.remove("mobile-chat-history-open");
    }
  });
}

function syncMobileShell() {
  syncResponsiveHomeRoute();
  syncMobileShellClasses();
  syncInjectedTopbar();
  ensureMobileChatTopbar();
}

document.addEventListener("DOMContentLoaded", syncMobileShell);
setTimeout(syncMobileShell, 250);
setTimeout(syncMobileShell, 900);
addEventListener("popstate", syncMobileShell);
addEventListener("resize", syncMobileShell);
