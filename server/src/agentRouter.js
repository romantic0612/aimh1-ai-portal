export const AGENT_REGISTRY = {
  general: {
    id: "general",
    name: "农芯智 AI",
    type: "supervisor_default",
    provider: "minimax",
    description: "默认模型 MiniMax，处理问候、闲聊、写作、润色、总结、翻译、代码、普通知识、无法归类问题。",
    keywords: [
      "你好",
      "您好",
      "写作",
      "作文",
      "文章",
      "润色",
      "总结",
      "翻译",
      "代码",
      "报错",
      "知识"
    ],
    examples: [
      "你好",
      "帮我写一篇关于图书馆文化的作文",
      "帮我总结这份教务通知",
      "数据库怎么连不上"
    ],
    defaultStrategy: "single_agent"
  },
  jiaowu: {
    id: "jiaowu",
    name: "教务智能体",
    type: "business_agent",
    provider: "dify",
    description: "处理课程、课表、选课、成绩、考试、补考、重修、学籍、培养方案、毕业学分、绩点等。",
    keywords: [
      "教务",
      "教务处",
      "课程",
      "课表",
      "选课",
      "成绩",
      "查成绩",
      "考试",
      "补考",
      "重修",
      "学籍",
      "培养方案",
      "毕业学分",
      "毕业",
      "学分",
      "绩点",
      "转专业",
      "缓考",
      "报名",
      "academic",
      "course",
      "exam"
    ],
    examples: ["我怎么查成绩", "补考什么时候报名", "毕业学分要求是什么"],
    defaultStrategy: "single_agent"
  },
  library: {
    id: "library",
    name: "AI 馆员",
    type: "business_agent",
    provider: "dify",
    description: "处理图书馆、借书、还书、续借、论文、文献、数据库、馆藏、座位预约、知网、万方等。",
    keywords: [
      "图书馆",
      "图书",
      "借书",
      "还书",
      "续借",
      "论文",
      "文献",
      "论文数据库",
      "文献数据库",
      "数据库",
      "馆藏",
      "馆员",
      "座位",
      "座位预约",
      "期刊",
      "检索",
      "知网",
      "万方",
      "library"
    ],
    examples: ["图书馆怎么续借", "知网入口在哪里", "我想查论文数据库"],
    defaultStrategy: "single_agent"
  },
  xg: {
    id: "xg",
    name: "学工智能体",
    type: "business_agent",
    provider: "dify",
    description: "处理学工、辅导员、学生事务、奖助贷、宿舍、报到、军训、校园生活、心理咨询等学生服务问题。",
    keywords: [
      "学工",
      "学生工作",
      "辅导员",
      "学生事务",
      "奖学金",
      "助学金",
      "助学贷款",
      "贫困认定",
      "勤工助学",
      "处分",
      "评优",
      "评奖",
      "心理",
      "心理咨询",
      "宿舍",
      "寝室",
      "门禁",
      "食堂",
      "军训",
      "新生",
      "新生向导",
      "报到",
      "报道",
      "迎新",
      "入学",
      "校园向导",
      "安农大",
      "地铁",
      "快递",
      "社团",
      "生活",
      "xg"
    ],
    examples: ["奖学金怎么申请", "辅导员在哪里联系", "宿舍门禁几点", "报到要带什么东西？"],
    defaultStrategy: "single_agent"
  },
  data: {
    id: "data",
    name: "AI问数",
    type: "business_agent",
    provider: "dify",
    description: "处理校内数据查询、统计口径、数据看板、业务指标、趋势分析和问数取数类问题。",
    keywords: [
      "问数",
      "数据",
      "统计",
      "指标",
      "报表",
      "看板",
      "分析",
      "趋势",
      "人数",
      "数量",
      "占比",
      "汇总",
      "取数",
      "查询数据",
      "data",
      "analytics"
    ],
    examples: ["帮我查一下学生相关统计数据", "这个指标口径是什么", "生成一份数据汇总"],
    defaultStrategy: "single_agent"
  },
  service: {
    id: "service",
    name: "AI办事",
    type: "business_agent",
    provider: "dify",
    description: "处理校内事项办理、办事流程、材料清单、办理入口、进度说明和跨部门服务指引。",
    keywords: [
      "办事",
      "办理",
      "流程",
      "事项",
      "服务",
      "材料",
      "证明",
      "申请",
      "审批",
      "入口",
      "进度",
      "一网通办",
      "办事大厅",
      "怎么提交",
      "service"
    ],
    examples: ["这个事项怎么办理", "需要准备哪些材料", "办事入口在哪里"],
    defaultStrategy: "single_agent"
  }
};

export const ROUTABLE_AGENT_IDS = Object.keys(AGENT_REGISTRY);
export const BUSINESS_AGENT_IDS = ROUTABLE_AGENT_IDS.filter((id) => AGENT_REGISTRY[id].type === "business_agent");

function normalizeRoutingText(value) {
  return String(value || "").trim().slice(0, 4000).toLowerCase();
}

export function normalizeAgentId(value, fallback = "general") {
  const id = String(value || "").trim();
  return ROUTABLE_AGENT_IDS.includes(id) ? id : fallback;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function isGeneralTask(text) {
  return (
    /(?:帮我|请|给我)?(?:写|撰写|起草|生成|改写|扩写|缩写|润色|修改|优化|总结|概括|翻译|解释代码|写代码|编程|debug|调试)/i.test(text) ||
    /(?:作文|文章|文案|邮件|通知|总结|翻译|代码|脚本|程序|报错|bug|debug)/i.test(text) ||
    /数据库.*(?:连不上|连接不上|连接失败|报错|错误|配置|驱动|端口|mysql|sql|jdbc|odbc|connection)/i.test(text)
  );
}

function isShortFollowup(text) {
  const compact = text.replace(/\s+/g, "");
  if (!compact || compact.length > 16) return false;
  return (
    /^(那|这个|那个|它|继续|继续说|还有|然后|入口呢|报名入口呢|在哪里看|在哪看|什么时候|怎么办|怎么弄|怎么查|咋办|咋查|报名吗|报名呢|什么时候报名|在哪里|在哪)(呢|吗|呀|？|\?)?$/.test(
      compact
    ) || /(?:什么时候|怎么办|在哪里|在哪|入口|报名|继续说)$/.test(compact)
  );
}

function confidenceFromScore(score) {
  if (score >= 5) return 0.97;
  if (score >= 3) return 0.92;
  if (score >= 2) return 0.86;
  if (score >= 1) return 0.72;
  return 0.35;
}

export function scoreAgentByRule(text, agent) {
  const normalized = normalizeRoutingText(text);
  const hits = [];
  let score = 0;

  if (!agent || agent.type !== "business_agent") {
    return { score: 0, hits };
  }

  for (const keyword of agent.keywords || []) {
    const item = String(keyword || "").trim().toLowerCase();
    if (!item || !normalized.includes(item)) continue;
    hits.push(keyword);
    score += item.length >= 3 ? 2 : 1;
  }

  return { score, hits: unique(hits) };
}

function buildCandidates(text) {
  return BUSINESS_AGENT_IDS.map((agentId) => {
    const agent = AGENT_REGISTRY[agentId];
    const scored = scoreAgentByRule(text, agent);
    return {
      agentId,
      name: agent.name,
      score: scored.score,
      hits: scored.hits,
      confidence: confidenceFromScore(scored.score)
    };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.agentId.localeCompare(b.agentId));
}

function matchedKeywordsFromCandidates(candidates) {
  return Object.fromEntries(candidates.map((item) => [item.agentId, item.hits]));
}

function createRoute({
  strategy,
  agentIds,
  confidence,
  reason,
  matchedKeywords,
  candidates,
  planner = "rule",
  clarificationQuestion = ""
}) {
  const normalizedIds = unique((Array.isArray(agentIds) ? agentIds : [agentIds]).map((id) => normalizeAgentId(id))).filter(
    (id) => ROUTABLE_AGENT_IDS.includes(id)
  );
  const finalAgentIds = normalizedIds.length ? normalizedIds : ["general"];
  const agents = finalAgentIds.map((id) => AGENT_REGISTRY[id]);
  return {
    strategy,
    agent: agents[0],
    agentId: finalAgentIds[0],
    agents,
    agentIds: finalAgentIds,
    confidence,
    reason,
    matchedKeywords: matchedKeywords || {},
    candidates: candidates || [],
    planner,
    clarification_question: clarificationQuestion,
    message: clarificationQuestion
  };
}

export function selectAgentByRuleV2(message, context = {}) {
  const text = normalizeRoutingText(message);
  const candidates = buildCandidates(text);
  const matchedKeywords = matchedKeywordsFromCandidates(candidates);

  if (isGeneralTask(text)) {
    return createRoute({
      strategy: "single_agent",
      agentIds: ["general"],
      confidence: 0.96,
      reason: "用户是在写作、润色、总结、翻译、代码或技术排障场景，优先由默认模型处理。",
      matchedKeywords,
      candidates
    });
  }

  const top = candidates[0];
  const previousAgentId = normalizeAgentId(context.previousAgentId, "");
  if (top && isShortFollowup(text) && BUSINESS_AGENT_IDS.includes(previousAgentId) && confidenceFromScore(top.score) < 0.85) {
    return createRoute({
      strategy: "context_followup",
      agentIds: [previousAgentId],
      confidence: 0.88,
      reason: "当前问题像上下文追问，沿用当前会话最近一次业务智能体。",
      matchedKeywords,
      candidates
    });
  }
  if (!top && isShortFollowup(text) && BUSINESS_AGENT_IDS.includes(previousAgentId)) {
    return createRoute({
      strategy: "context_followup",
      agentIds: [previousAgentId],
      confidence: 0.88,
      reason: "当前问题像上下文追问，沿用当前会话最近一次业务智能体。",
      matchedKeywords,
      candidates
    });
  }

  const meaningful = candidates.filter((item) => item.score >= 2);
  const hasMultiIntentMarker = /(?:还想|同时|另外|以及|并且|还有|又|，|,|；|;|、|\s和\s|和.*(?:问|查|办理|了解))/i.test(text);
  if (meaningful.length >= 2 && (hasMultiIntentMarker || meaningful[1].score >= 2)) {
    return createRoute({
      strategy: "multi_agent_parallel",
      agentIds: meaningful.map((item) => item.agentId),
      confidence: Math.min(0.95, Math.max(0.88, meaningful[0].confidence)),
      reason: "用户问题同时命中多个业务智能体，直接并行调用后由农芯智汇总。",
      matchedKeywords,
      candidates
    });
  }

  if (top) {
    return createRoute({
      strategy: "single_agent",
      agentIds: [top.agentId],
      confidence: top.confidence,
      reason: `规则关键词命中 ${AGENT_REGISTRY[top.agentId].name}。`,
      matchedKeywords,
      candidates
    });
  }

  return createRoute({
    strategy: "single_agent",
    agentIds: ["general"],
    confidence: 0.78,
    reason: "未命中明确业务智能体，使用农芯智默认模型。",
    matchedKeywords,
    candidates
  });
}
