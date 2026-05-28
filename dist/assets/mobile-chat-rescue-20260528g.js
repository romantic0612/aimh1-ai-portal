function mobileChatRescueActive() {
  return location.pathname.replace(/\/+$/, "") === "/chat";
}

function mobileChatVisibleAssistantCount() {
  return [...document.querySelectorAll(".chat-window .message.assistant")]
    .filter((item) => item.textContent.trim() || item.querySelector(".typing-dots")).length;
}

function mobileChatInstallRescue() {
  if (!mobileChatRescueActive()) return;
  const form = document.querySelector(".chat-input");
  if (!form || form.dataset.mobileRescueBound === "1") return;
  form.dataset.mobileRescueBound = "1";
  form.addEventListener("submit", () => {
    const before = mobileChatVisibleAssistantCount();
    window.setTimeout(() => {
      if (!mobileChatRescueActive()) return;
      const after = mobileChatVisibleAssistantCount();
      const thinking = document.querySelector(".chat-window .message.assistant.thinking");
      if (thinking) {
        thinking.setAttribute("data-mobile-waiting", "正在思考中...");
      } else if (after <= before) {
        const win = document.querySelector(".chat-window");
        if (!win || win.querySelector(".mobile-chat-rescue-note")) return;
        const note = document.createElement("article");
        note.className = "message assistant error mobile-chat-rescue-note";
        note.textContent = "请求已发出，但暂时没有收到回复。请稍等，或重新发送一次。";
        win.appendChild(note);
        win.scrollTop = win.scrollHeight;
      }
    }, 1200);
    window.setTimeout(() => {
      const thinking = document.querySelector(".chat-window .message.assistant.thinking");
      if (thinking) thinking.setAttribute("data-mobile-waiting", "仍在等待智能体响应...");
    }, 12000);
  }, true);
}

document.addEventListener("DOMContentLoaded", mobileChatInstallRescue);
setTimeout(mobileChatInstallRescue, 400);
setTimeout(mobileChatInstallRescue, 1200);
