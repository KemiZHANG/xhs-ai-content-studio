export type AcceptanceCoverageItem = {
  id: string;
  label: string;
  status: "verified" | "manual_required";
  evidence: string[];
};

export type AcceptanceExternalGate = {
  id: "real_publish" | "scheduled_publish" | "multi_account_switching" | "large_scale_image_generation";
  label: string;
  reason: string;
  guide: string;
  firstSafeStep: string;
};

export type AcceptanceStatus = {
  completionPercent: number;
  summary: string;
  canMarkComplete: boolean;
  verified: AcceptanceCoverageItem[];
  manualGates: AcceptanceExternalGate[];
  recommendedCommands: string[];
};

const verified: AcceptanceCoverageItem[] = [
  {
    id: "post_project",
    label: "统一 PostProject、PostStage 和 allowedActions",
    status: "verified",
    evidence: ["lib/post-project/store.ts", "lib/post-project/stage-machine.ts", "tests/post-project.test.ts"]
  },
  {
    id: "post_studio",
    label: "Post Studio 三栏创作台和信息降噪",
    status: "verified",
    evidence: ["app/components/post-studio-panel.tsx", "tests/post-studio-*.test.ts"]
  },
  {
    id: "agent_director",
    label: "内容创作导演型 Agent、cards、quickActions 和 toolTrace",
    status: "verified",
    evidence: ["lib/agent/orchestrator.ts", "lib/agent/planner.ts", "tests/agent-orchestrator.test.ts"]
  },
  {
    id: "creative_brief",
    label: "CreativeBrief 统一驱动文案和图片方向",
    status: "verified",
    evidence: ["lib/post-project/brief.ts", "tests/post-brief.test.ts", "tests/evidence-citations.test.ts"]
  },
  {
    id: "viral_rag",
    label: "爆款库 RAG、结构化入库和证据合并",
    status: "verified",
    evidence: ["lib/viral-knowledge/store.ts", "lib/rag/viral.ts", "tests/viral-knowledge.test.ts"]
  },
  {
    id: "publish_safety",
    label: "发布确认、Quality Gate、审计和 dry-run",
    status: "verified",
    evidence: ["lib/agent/guardrails.ts", "lib/post-project/quality.ts", "scripts/publish-dry-run-smoke.mjs"]
  }
];

const manualGates: AcceptanceExternalGate[] = [
  {
    id: "real_publish",
    label: "真实发布到小红书",
    reason: "会对真实外部账号产生写入动作，不能由自动测试代替人工授权。",
    guide: "docs/real-publish-acceptance.md",
    firstSafeStep: "先生成仅自己可见的发布确认单。"
  },
  {
    id: "scheduled_publish",
    label: "真实定时发布到小红书",
    reason: "会创建真实定时发布任务，必须确认时区、时间和账号。",
    guide: "docs/real-publish-acceptance.md",
    firstSafeStep: "先用未来时间生成定时发布确认单。"
  },
  {
    id: "multi_account_switching",
    label: "多个真实账号切换验收",
    reason: "需要多个独立 MCP 实例和多个真实登录会话。",
    guide: "docs/multi-account-acceptance.md",
    firstSafeStep: "分别启动 18060、18061 等 MCP 端口并运行 npm run smoke:accounts。"
  },
  {
    id: "large_scale_image_generation",
    label: "大量真实模型生图",
    reason: "可能产生模型费用，需要由使用者决定调用规模。",
    guide: "README.md",
    firstSafeStep: "先小批量生成 1-3 张，再提高每日图片调用上限。"
  }
];

export function buildAcceptanceStatus(): AcceptanceStatus {
  return {
    completionPercent: 98,
    summary: "核心 Post Studio Agent、PostProject、CreativeBrief、RAG、图片、发布确认和安全审计已由代码、测试和 smoke 覆盖；剩余为真实外部账号动作验收。",
    canMarkComplete: false,
    verified,
    manualGates,
    recommendedCommands: [
      "npm run verify",
      "npm run smoke:safe",
      "npm run smoke:research",
      "npm run smoke:publish-dry-run",
      "npm run smoke:accounts"
    ]
  };
}

