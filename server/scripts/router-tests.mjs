import assert from "node:assert/strict";
import { selectAgentByRuleV2 } from "../src/agentRouter.js";

const cases = [
  {
    message: "你好",
    strategy: "single_agent",
    agentIds: ["general"]
  },
  {
    message: "帮我写一篇关于图书馆文化的作文",
    strategy: "single_agent",
    agentIds: ["general"]
  },
  {
    message: "图书馆怎么续借",
    strategy: "single_agent",
    agentIds: ["library"]
  },
  {
    message: "知网入口在哪里",
    strategy: "single_agent",
    agentIds: ["library"]
  },
  {
    message: "我怎么查成绩",
    strategy: "single_agent",
    agentIds: ["jiaowu"]
  },
  {
    message: "补考什么时候报名",
    strategy: "single_agent",
    agentIds: ["jiaowu"]
  },
  {
    message: "怎么开在职证明",
    strategy: "single_agent",
    agentIds: ["renshi"]
  },
  {
    message: "职称评审材料怎么提交",
    strategy: "single_agent",
    agentIds: ["renshi"]
  },
  {
    message: "报到要带什么东西？",
    strategy: "single_agent",
    agentIds: ["nongxiaoxin"]
  },
  {
    message: "安农大在哪坐地铁？宿舍是几人间？有空调吗？",
    strategy: "single_agent",
    agentIds: ["nongxiaoxin"]
  },
  {
    message: "宿舍门禁几点",
    strategy: "single_agent",
    agentIds: ["nongxiaoxin"]
  },
  {
    message: "我想查论文数据库，还想问毕业学分要求",
    strategy: "multi_agent_parallel",
    agentIds: ["library", "jiaowu"]
  },
  {
    message: "那什么时候报名",
    context: { previousAgentId: "jiaowu" },
    strategy: "context_followup",
    agentIds: ["jiaowu"]
  },
  {
    message: "数据库怎么连不上",
    strategy: "single_agent",
    agentIds: ["general"]
  },
  {
    message: "帮我总结这份教务通知",
    strategy: "single_agent",
    agentIds: ["general"]
  }
];

for (const item of cases) {
  const route = selectAgentByRuleV2(item.message, item.context || {});
  assert.equal(route.strategy, item.strategy, `${item.message} strategy`);
  assert.deepEqual(route.agentIds, item.agentIds, `${item.message} agentIds`);
}

console.log(`router tests passed: ${cases.length}`);
