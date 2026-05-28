function mobileShellPath() {
  return location.pathname.replace(/\/+$/, "") || "/";
}

function syncMobileShellClasses() {
  const path = mobileShellPath();
  document.documentElement.classList.toggle("mobile-chat-frame", path === "/chat");
  document.documentElement.classList.toggle("mobile-rank", path === "/mobile/rank");
  document.documentElement.classList.toggle("mobile-home-frame", path === "/mobile");
  document.documentElement.classList.toggle("mobile-preview", path === "/mobile" || path === "/mobile/rank" || path === "/chat");
}

function readProfileLabel() {
  const profile = document.querySelector(".topbar .profile-button");
  const name = profile?.querySelector("strong")?.textContent?.trim() || "个人";
  const role = profile?.querySelector("small")?.textContent?.trim() || "";
  return { name, role };
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
    brand.innerHTML = '<img src="/logo.png" alt=""><span><b>农芯智</b><small>AI Portal</small></span>';
    topbar.querySelector(".mobile-frame-menu")?.replaceWith(brand);
  }

  if (!topbar.querySelector(".mobile-frame-profile")) {
    const profile = document.createElement("button");
    profile.className = "mobile-frame-profile";
    profile.type = "button";
    topbar.querySelector(".mobile-frame-new")?.replaceWith(profile);
  }
  const { name, role } = readProfileLabel();
  const profile = topbar.querySelector(".mobile-frame-profile");
  if (profile) {
    profile.innerHTML = `<strong>${name}</strong>${role ? `<small>${role}</small>` : ""}`;
  }
}

function ensureMobileChatTopbar() {
  if (mobileShellPath() !== "/chat") return;
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
  syncMobileShellClasses();
  syncInjectedTopbar();
  ensureMobileChatTopbar();
}

document.addEventListener("DOMContentLoaded", syncMobileShell);
setTimeout(syncMobileShell, 250);
setTimeout(syncMobileShell, 900);
addEventListener("popstate", syncMobileShell);
