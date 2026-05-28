function mobileChatIsActive() {
  return location.pathname.replace(/\/+$/, "") === "/chat";
}

function mobileChatEscape(value) {
  return String(value || "").replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  })[char]);
}

function mobileChatGroupLabel(item, index) {
  const label = String(item.displayTime || item.updateTime || item.createTime || "");
  if (label.includes("今天")) return "今天";
  if (label.includes("昨天")) return "昨天";
  if (index < 2) return index === 0 ? "今天" : "昨天";
  return "7天内";
}

function renderMobileHistoryList(query = "") {
  const sidebar = document.querySelector(".chat-sidebar");
  if (!sidebar || !mobileChatIsActive()) return;
  sidebar.querySelectorAll(".mobile-history-group").forEach((node) => node.remove());
  sidebar.querySelectorAll(".history-row").forEach((row) => {
    row.classList.add("mobile-history-line");
    row.classList.remove("is-mobile-first");
  });
  const rows = [...sidebar.querySelectorAll(".history-row")].map((row, index) => {
    const title = row.querySelector(".history-item strong")?.textContent?.trim() || "新对话";
    const time = row.querySelector(".history-item small")?.textContent?.trim() || "";
    return { row, title, time, group: mobileChatGroupLabel({ displayTime: time }, index) };
  }).filter((item) => item.title.includes(query));

  let current = "";
  rows.forEach((item, index) => {
    let heading = "";
    if (item.group !== current) {
      current = item.group;
      heading = `<div class="mobile-history-group">${mobileChatEscape(current)}</div>`;
    }
    item.row.classList.toggle("is-mobile-first", index === 0);
    item.row.style.display = "";
    item.row.insertAdjacentHTML("beforebegin", heading);
  });
}

function rebuildMobileHistoryDrawer() {
  if (!mobileChatIsActive()) return;
  const sidebar = document.querySelector(".chat-sidebar");
  if (!sidebar) return;

  const head = sidebar.querySelector(".side-head");
  if (head && !sidebar.querySelector(".mobile-history-search")) {
    head.insertAdjacentHTML("beforebegin", '<label class="mobile-history-search"><span></span><input type="search" placeholder="搜索聊天内容..."></label>');
  }

  sidebar.querySelectorAll(".history-row").forEach((row) => {
    row.classList.add("mobile-history-line");
  });

  const query = sidebar.querySelector(".mobile-history-search input")?.value?.trim() || "";
  renderMobileHistoryList(query);

  const search = sidebar.querySelector(".mobile-history-search input");
  if (search && search.dataset.mobileHistoryBound !== "1") {
    search.dataset.mobileHistoryBound = "1";
    search.addEventListener("input", (event) => {
    sidebar.querySelectorAll(".mobile-history-group").forEach((node) => node.remove());
    const query = event.target.value.trim();
    sidebar.querySelectorAll(".history-row").forEach((row) => {
      const title = row.querySelector(".history-item strong")?.textContent || "";
      row.style.display = title.includes(query) ? "" : "none";
    });
    renderMobileHistoryList(query);
    });
  }
}

function syncMobileChatSendButton() {
  if (!mobileChatIsActive()) return;
  const form = document.querySelector(".chat-input");
  const input = form?.querySelector("input");
  const button = form?.querySelector('button[type="submit"]');
  if (!form || !input || !button) return;
  input.placeholder = "发消息";
  button.textContent = "发送";
  button.setAttribute("aria-label", "发送消息");
}

function syncMobileChatHistory() {
  syncMobileChatSendButton();
  rebuildMobileHistoryDrawer();
}

document.addEventListener("DOMContentLoaded", syncMobileChatHistory);
setTimeout(syncMobileChatHistory, 300);
setTimeout(syncMobileChatHistory, 1000);
setTimeout(syncMobileChatHistory, 1800);
addEventListener("popstate", syncMobileChatHistory);
