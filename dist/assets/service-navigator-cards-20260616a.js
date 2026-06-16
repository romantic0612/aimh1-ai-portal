(function () {
  const originalFetch = window.fetch;
  if (!originalFetch || window.__serviceNavigatorCardsPatched) return;
  window.__serviceNavigatorCardsPatched = true;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function normalizeCards(value) {
    return (Array.isArray(value) ? value : []).filter((card) => card && typeof card === "object");
  }

  function renderCard(card) {
    const materials = Array.isArray(card.materials) ? card.materials.filter(Boolean) : [];
    const steps = Array.isArray(card.processSteps)
      ? card.processSteps.filter(Boolean)
      : Array.isArray(card.process_steps)
        ? card.process_steps.filter(Boolean)
        : [];
    const entryUrl = card.entryUrl || card.entry_url || card.url || "";
    return [
      '<section class="service-card">',
      '<div class="service-card-head">',
      `<span>${esc(card.category || "办事事项")}</span>`,
      `<strong>${esc(card.title || card.name || "未命名事项")}</strong>`,
      "</div>",
      card.description ? `<p>${esc(card.description)}</p>` : "",
      card.department ? `<small>办理部门：${esc(card.department)}</small>` : "",
      materials.length ? `<div><b>所需材料</b><ul>${materials.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>` : "",
      steps.length ? `<div><b>办理流程</b><ol>${steps.map((item) => `<li>${esc(item)}</li>`).join("")}</ol></div>` : "",
      card.notice ? `<em>${esc(card.notice)}</em>` : "",
      entryUrl ? `<a href="${esc(entryUrl)}" target="_blank" rel="noopener noreferrer">立即办理</a>` : "",
      "</section>"
    ].join("");
  }

  function mountCards(cards) {
    const items = normalizeCards(cards);
    if (!items.length) return;
    requestAnimationFrame(() => {
      const messages = Array.from(document.querySelectorAll(".chat-window .message.assistant"));
      const target = messages[messages.length - 1];
      if (!target) return;
      let list = target.querySelector(".service-card-list");
      if (!list) {
        list = document.createElement("div");
        list.className = "service-card-list";
        target.appendChild(list);
      }
      list.innerHTML = items.map(renderCard).join("");
      const chatWindow = document.querySelector(".chat-window");
      if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
    });
  }

  async function tapStream(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const packets = buffer.split("\n\n");
      buffer = packets.pop() || "";
      for (const packet of packets) {
        for (const line of packet.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          if (!raw || raw === "[DONE]") continue;
          try {
            const event = JSON.parse(raw);
            if (event.type === "tool_result" && event.tool_name === "call_service_navigator") {
              mountCards(event.data && (event.data.service_cards || event.data.serviceCards));
            }
          } catch {
            // Ignore non-JSON SSE comments or partial packets.
          }
        }
      }
    }
  }

  window.fetch = async function patchedFetch(input, init) {
    const response = await originalFetch.apply(this, arguments);
    try {
      const url = typeof input === "string" ? input : input && input.url;
      const isChatStream = String(url || "").includes("/api/chat/stream");
      if (!isChatStream || !response.body || typeof response.body.tee !== "function") return response;
      const streams = response.body.tee();
      tapStream(streams[1]).catch(() => {});
      return new Response(streams[0], {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch {
      return response;
    }
  };
})();
