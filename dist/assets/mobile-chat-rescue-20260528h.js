function mobileChatRescueActiveV2() {
  return location.pathname.replace(/\/+$/, "") === "/chat";
}

function mobileChatAssistantCountV2() {
  return [...document.querySelectorAll(".chat-window .message.assistant")]
    .filter((item) => item.textContent.trim() || item.querySelector(".typing-dots")).length;
}

function mobileChatSetWaitingTextV2(text) {
  document.querySelectorAll(".chat-window .message.assistant.thinking").forEach((item) => {
    item.setAttribute("data-mobile-waiting", text);
  });
}

function mobileChatInstallTextRepairV2() {
  if (!mobileChatRescueActiveV2() || window.__mobileChatTextRepairV2) return;
  window.__mobileChatTextRepairV2 = true;
  const waiting = "\u6b63\u5728\u601d\u8003\u4e2d...";
  const later = "\u4ecd\u5728\u7b49\u5f85\u667a\u80fd\u4f53\u54cd\u5e94...";
  const observer = new MutationObserver(() => {
    document.querySelectorAll(".chat-window .message.assistant.thinking").forEach((item) => {
      const current = item.getAttribute("data-mobile-waiting") || "";
      if (!current || /[\u00c0-\u00ff]/.test(current)) {
        item.setAttribute("data-mobile-waiting", waiting);
      }
    });
    document.querySelectorAll(".mobile-chat-rescue-note").forEach((item) => {
      if (/[\u00c0-\u00ff]/.test(item.textContent)) {
        item.textContent = "\u8bf7\u6c42\u5df2\u53d1\u51fa\uff0c\u4f46\u6682\u65f6\u6ca1\u6709\u6536\u5230\u56de\u590d\u3002\u8bf7\u7a0d\u7b49\uff0c\u6216\u91cd\u65b0\u53d1\u9001\u4e00\u6b21\u3002";
      }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-mobile-waiting"] });
  window.setInterval(() => mobileChatSetWaitingTextV2(later), 18000);
}

function mobileChatInstallRescueV2() {
  if (!mobileChatRescueActiveV2()) return;
  mobileChatInstallTextRepairV2();
  const form = document.querySelector(".chat-input");
  if (!form || form.dataset.mobileRescueBoundV2 === "1") return;
  form.dataset.mobileRescueBoundV2 = "1";
  form.addEventListener("submit", () => {
    const before = mobileChatAssistantCountV2();
    window.setTimeout(() => {
      if (!mobileChatRescueActiveV2()) return;
      mobileChatSetWaitingTextV2("\u6b63\u5728\u601d\u8003\u4e2d...");
      const after = mobileChatAssistantCountV2();
      const thinking = document.querySelector(".chat-window .message.assistant.thinking");
      if (!thinking && after <= before) {
        const win = document.querySelector(".chat-window");
        if (!win || win.querySelector(".mobile-chat-rescue-note")) return;
        const note = document.createElement("article");
        note.className = "message assistant error mobile-chat-rescue-note";
        note.textContent = "\u8bf7\u6c42\u5df2\u53d1\u51fa\uff0c\u4f46\u6682\u65f6\u6ca1\u6709\u6536\u5230\u56de\u590d\u3002\u8bf7\u7a0d\u7b49\uff0c\u6216\u91cd\u65b0\u53d1\u9001\u4e00\u6b21\u3002";
        win.appendChild(note);
        win.scrollTop = win.scrollHeight;
      }
    }, 1350);
    window.setTimeout(() => {
      mobileChatSetWaitingTextV2("\u4ecd\u5728\u7b49\u5f85\u667a\u80fd\u4f53\u54cd\u5e94...");
    }, 12100);
  }, true);
}

document.addEventListener("DOMContentLoaded", mobileChatInstallRescueV2);
setTimeout(mobileChatInstallRescueV2, 400);
setTimeout(mobileChatInstallRescueV2, 1200);
