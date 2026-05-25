(function () {
  const agents = {
    jiaowu: {
      title: "教务智能体",
      short: "教务",
      desc: "查询课表、成绩、考试安排、培养方案和学籍政策。",
      icon: "教",
      placeholder: "可以问我课表、成绩、考试、培养方案...",
      welcome: "你好，我是教务智能体。你可以问我课表、成绩、考试安排、培养方案和学籍政策。",
      samples: ["我怎么查成绩", "补考什么时候报名", "毕业学分要求是什么"]
    },
    library: {
      title: "AI 馆员",
      short: "馆员",
      desc: "解答馆藏检索、借阅续借、数据库入口和文献资源。",
      icon: "馆",
      placeholder: "可以问我馆藏、借阅、数据库入口...",
      welcome: "你好，我是 AI 馆员。你可以问我馆藏资源、借阅规则、数据库使用或图书馆开放时间。",
      samples: ["图书馆怎么续借", "知网入口在哪里", "我想查论文数据库"]
    },
    xg: {
      title: "学工智能体",
      short: "学工",
      desc: "服务学生事务、奖助政策、请假流程、宿舍和校园生活。",
      icon: "学",
      placeholder: "可以问我奖助政策、请假流程、校园服务...",
      welcome: "你好，我是学工智能体。你可以问我学生事务、奖助政策、请假流程或成长发展相关问题。",
      samples: ["奖学金怎么申请", "宿舍门禁几点", "报到要带什么东西"]
    }
  };

  let activeAgent = "jiaowu";
  let lastPath = "";

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function goChat(question) {
    const text = String(question || "").trim();
    if (!text) return;
    window.location.href = `/chat?q=${encodeURIComponent(text)}`;
  }

  function switchPage(path) {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  async function loadUserName() {
    try {
      const response = await fetch("/api/auth/session", { credentials: "include" });
      const payload = await response.json().catch(() => ({}));
      const user = payload.user || payload.data || {};
      return user.name || user.realName || user.user_name || user.userId || user.user_id || "";
    } catch {
      return "";
    }
  }

  function renderAgentMenu() {
    return Object.entries(agents).map(([key, agent]) => `
      <button class="agri-agent-card ${key === activeAgent ? "active" : ""}" type="button" data-agri-agent="${key}">
        <span class="agri-agent-icon">${agent.icon}</span>
        <span>
          <strong>${agent.title}</strong>
          <span>${agent.desc}</span>
        </span>
      </button>
    `).join("");
  }

  function renderPreview() {
    const agent = agents[activeAgent];
    return `
      <div class="agri-preview-title">
        <div>
          <h3>${agent.title}正在为你服务</h3>
          <p>${agent.desc}</p>
        </div>
        <span class="agri-status-pill">在线响应</span>
      </div>
      <div class="agri-chat-preview" aria-label="${agent.title} 对话预览">
        <div class="agri-bubble assistant">${agent.welcome}</div>
        <div class="agri-bubble user">${agent.samples[0]}</div>
        <div class="agri-bubble assistant">我会把你的问题带入现有 AIMH1 聊天流程，由门户后端通过 SSE 流式返回真实回答。</div>
      </div>
      <div class="agri-chips">
        ${agent.samples.map((sample) => `<button class="agri-chip" type="button" data-agri-question="${escapeHtml(sample)}">${escapeHtml(sample)}</button>`).join("")}
      </div>
    `;
  }

  function bindHome(root) {
    root.querySelectorAll("[data-agri-agent]").forEach((button) => {
      button.addEventListener("click", () => {
        activeAgent = button.dataset.agriAgent || "jiaowu";
        root.querySelector(".agri-agent-list").innerHTML = renderAgentMenu();
        root.querySelector(".agri-preview").innerHTML = renderPreview();
        bindHome(root);
        const input = root.querySelector(".agri-ask-input");
        if (input) input.placeholder = agents[activeAgent].placeholder;
      });
    });

    root.querySelectorAll("[data-agri-question]").forEach((button) => {
      button.addEventListener("click", () => goChat(button.dataset.agriQuestion || button.textContent));
    });

    root.querySelectorAll("[data-agri-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.agriTarget || "";
        if (target === "agents") switchPage("/agents");
        if (target === "contest") document.getElementById("agri-contest")?.scrollIntoView({ behavior: "smooth", block: "start" });
        if (target === "chat") goChat(agents[activeAgent].samples[0]);
      });
    });

    const form = root.querySelector(".agri-ask-form");
    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        goChat(root.querySelector(".agri-ask-input")?.value || "");
      });
    }
  }

  function homeMarkup(userName) {
    const displayName = userName ? `${escapeHtml(userName)}，欢迎回来` : "欢迎来到农芯智 AI";
    return `
      <section class="agri-portal-home" aria-label="安徽农业大学 AI 门户新版首页">
        <div class="agri-portal-hero">
          <div class="agri-hero-inner">
            <div class="agri-brand-row">
              <img src="/assets/school-logo.png" alt="安徽农业大学">
              <span>AI PORTAL · 农芯智</span>
            </div>
            <div class="agri-hero-copy">
              <h1>${displayName}</h1>
              <p>面向学习、科研、生活和管理服务的校园 AI 门户。教务、图书馆、学工智能体已接入真实后端，常见校园问题可以从这里一站式发起。</p>
            </div>
            <div class="agri-hero-actions">
              <button class="agri-primary" type="button" data-agri-target="chat">开始提问</button>
              <button class="agri-ghost" type="button" data-agri-target="contest">AI 应用大赛</button>
              <button class="agri-ghost" type="button" data-agri-target="agents">智能体中心</button>
            </div>
            <div class="agri-ask-panel">
              <form class="agri-ask-form">
                <input class="agri-ask-input" type="search" placeholder="${agents[activeAgent].placeholder}" aria-label="输入校园 AI 问题">
                <button class="agri-send" type="submit">发送</button>
              </form>
            </div>
            <div class="agri-quick-grid" aria-label="快捷入口">
              <button class="agri-quick-card" type="button" data-agri-question="我怎么查成绩"><strong>教务服务</strong><span>课表、成绩、考试、培养方案。</span></button>
              <button class="agri-quick-card" type="button" data-agri-question="知网入口在哪里"><strong>AI 馆员</strong><span>馆藏、借阅、数据库、文献检索。</span></button>
              <button class="agri-quick-card" type="button" data-agri-question="奖学金怎么申请"><strong>学工服务</strong><span>奖助、宿舍、请假、学生事务。</span></button>
              <button class="agri-quick-card" type="button" data-agri-target="contest"><strong>AI 应用大赛</strong><span>校园真实场景、智能体作品展示。</span></button>
            </div>
          </div>
        </div>

        <section class="agri-section">
          <div class="agri-console">
            <div class="agri-console-head">
              <div>
                <div class="agri-kicker">AGENT CONSOLE</div>
                <h2>农芯智 AI 智能体中心</h2>
              </div>
              <span class="agri-live">3 个智能体在线</span>
            </div>
            <div class="agri-console-body">
              <div class="agri-agent-list">${renderAgentMenu()}</div>
              <div class="agri-preview">${renderPreview()}</div>
            </div>
          </div>
        </section>

        <section class="agri-section" id="agri-contest">
          <div class="agri-contest-card">
            <div>
              <div class="agri-kicker">AI AGENT INNOVATION CONTEST</div>
              <h2>AI 应用大赛</h2>
              <p>面向校园学习、生活、科研和管理服务真实场景征集可落地、可演示、可复用的 AI 智能体作品。</p>
              <div class="agri-console-actions">
                <button class="agri-primary" type="button" data-agri-target="agents">查看智能体</button>
                <button class="agri-ghost" type="button" data-agri-question="我想了解 AI 应用大赛">咨询大赛</button>
              </div>
            </div>
            <div class="agri-facts">
              <div class="agri-fact"><strong>A 赛道</strong><span>方案设计</span></div>
              <div class="agri-fact"><strong>B 赛道</strong><span>工具搭建</span></div>
              <div class="agri-fact"><strong>C 赛道</strong><span>代码开发</span></div>
            </div>
          </div>
        </section>
      </section>
    `;
  }

  async function enhanceHome() {
    const path = window.location.pathname;
    if (path !== "/" && path !== "/callback") return;
    const home = document.querySelector(".home-main");
    if (!home || home.dataset.agriEnhanced === "1") return;
    home.dataset.agriEnhanced = "1";
    const userName = await loadUserName();
    if (window.location.pathname !== "/" && window.location.pathname !== "/callback") return;
    home.innerHTML = homeMarkup(userName);
    bindHome(home);
  }

  function tick() {
    if (lastPath !== window.location.pathname) {
      lastPath = window.location.pathname;
      setTimeout(enhanceHome, 80);
    } else {
      enhanceHome();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    tick();
    const observer = new MutationObserver(tick);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("popstate", () => setTimeout(tick, 80));
  });
})();
