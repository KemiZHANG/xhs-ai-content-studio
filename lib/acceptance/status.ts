export type AcceptanceCoverageItem = {
  id: string;
  label: string;
  status: "verified" | "manual_required";
  evidence: string[];
};

export type AcceptanceEvidenceField = {
  key: string;
  label: string;
  example: string;
  required: boolean;
};

export type AcceptanceExternalGate = {
  id: "real_publish" | "scheduled_publish" | "multi_account_switching" | "large_scale_image_generation";
  label: string;
  reason: string;
  guide: string;
  firstSafeStep: string;
  proofRequired: string;
  checklist: string[];
  evidenceFields: AcceptanceEvidenceField[];
  canBeAutomated: boolean;
};

export type AcceptanceStatus = {
  completionPercent: number;
  summary: string;
  canMarkComplete: boolean;
  verified: AcceptanceCoverageItem[];
  manualGates: AcceptanceExternalGate[];
  recommendedCommands: string[];
};

export type AcceptanceDeliverySummary = {
  headline: string;
  stateLabel: string;
  completionLine: string;
  verifiedLine: string;
  manualGateLine: string;
  nextManualGateId: AcceptanceExternalGate["id"] | null;
  nextSafeCommand: string;
  safeToAutomateCompletion: boolean;
};

export type AcceptanceEvidencePackage = {
  schemaVersion: 1;
  generatedAt: string;
  purpose: string;
  completionPercent: number;
  canMarkComplete: boolean;
  commands: string[];
  gates: Array<{
    id: AcceptanceExternalGate["id"];
    label: string;
    guide: string;
    proofRequired: string;
    checklist: string[];
    evidenceFields: AcceptanceEvidenceField[];
    evidenceRecordTemplate: Record<string, string | boolean>;
    manualOnly: true;
  }>;
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
    firstSafeStep: "先生成仅自己可见的发布确认单。",
    proofRequired: "Post Studio 人工确认后，小红书账号中出现仅自己可见笔记，Publish History 记录 published 回执和账号/MCP URL。",
    checklist: [
      "Run npm run smoke:safe and confirm all local safety checks pass.",
      "Create a private visibility publish confirmation in Post Studio.",
      "Manually confirm only after title, copy, tags, selected images, account, visibility, and Quality Gate match the confirmation order.",
      "Verify the note appears in the active Xiaohongshu account.",
      "Verify Publish History records a published receipt with account, MCP URL, visibility, image count, and idempotency key."
    ],
    evidenceFields: [
      { key: "accountName", label: "Account name", example: "咖啡探店号", required: true },
      { key: "mcpUrl", label: "MCP URL", example: "http://localhost:18060/mcp", required: true },
      { key: "visibility", label: "Visibility", example: "仅自己可见", required: true },
      { key: "publishReceipt", label: "Publish receipt", example: "published receipt id or MCP response summary", required: true },
      { key: "xhsProof", label: "Xiaohongshu proof", example: "private note visible in the selected account", required: true }
    ],
    canBeAutomated: false
  },
  {
    id: "scheduled_publish",
    label: "真实定时发布到小红书",
    reason: "会创建真实定时发布任务，必须确认时区、时间和账号。",
    guide: "docs/real-publish-acceptance.md",
    firstSafeStep: "先用未来时间生成定时发布确认单。",
    proofRequired: "Post Studio 人工确认后，小红书账号中出现未来定时任务，Publish History 记录 scheduled 回执、时区和账号/MCP URL。",
    checklist: [
      "Choose a future schedule time and confirm the timezone shown in Post Studio.",
      "Create a scheduled publish confirmation with private visibility first.",
      "Manually confirm only after the schedule time, account, visibility, title, copy, tags, images, and Quality Gate match.",
      "Verify Xiaohongshu or the MCP response shows a future scheduled task.",
      "Verify Publish History records a scheduled receipt with schedule time, timezone, account, MCP URL, and idempotency key."
    ],
    evidenceFields: [
      { key: "accountName", label: "Account name", example: "咖啡探店号", required: true },
      { key: "mcpUrl", label: "MCP URL", example: "http://localhost:18060/mcp", required: true },
      { key: "scheduledAt", label: "Scheduled time", example: "2026-06-03 20:00 Asia/Shanghai", required: true },
      { key: "scheduleReceipt", label: "Schedule receipt", example: "scheduled receipt id or MCP response summary", required: true },
      { key: "futureTaskProof", label: "Future task proof", example: "future scheduled task appears in account or MCP response", required: true }
    ],
    canBeAutomated: false
  },
  {
    id: "multi_account_switching",
    label: "多个真实账号切换验收",
    reason: "需要多个独立 MCP 实例和多个真实登录会话。",
    guide: "docs/multi-account-acceptance.md",
    firstSafeStep: "分别启动 18060、18061 等 MCP 端口并运行 npm run smoke:accounts。",
    proofRequired: "至少两个真实账号分别通过独立 MCP URL 显示登录状态；切换账号后旧确认单失效，审计记录写入对应账号 ID 和 MCP URL。",
    checklist: [
      "Start at least two independent MCP sessions, such as 18060 and 18061.",
      "Log in with a different real Xiaohongshu account in each MCP session.",
      "Run npm run smoke:accounts and confirm both configured accounts are reachable.",
      "Switch from account A to account B in Settings or Post Studio.",
      "Verify the old publish confirmation is invalidated and a new confirmation is required.",
      "Verify audit or Publish History records the correct account ID when available and MCP URL for each account-specific action."
    ],
    evidenceFields: [
      { key: "accountA", label: "Account A", example: "display name + account id if available", required: true },
      { key: "accountAMcpUrl", label: "Account A MCP URL", example: "http://localhost:18060/mcp", required: true },
      { key: "accountB", label: "Account B", example: "display name + account id if available", required: true },
      { key: "accountBMcpUrl", label: "Account B MCP URL", example: "http://localhost:18061/mcp", required: true },
      { key: "confirmationInvalidation", label: "Confirmation invalidation", example: "old confirmation expired after switching accounts", required: true }
    ],
    canBeAutomated: false
  },
  {
    id: "large_scale_image_generation",
    label: "大量真实模型生图",
    reason: "可能产生模型费用，需要由使用者决定调用规模。",
    guide: "README.md",
    firstSafeStep: "先小批量生成 1-3 张，再提高每日图片调用上限。",
    proofRequired: "在真实图片模型额度下完成一轮小批量生图，确认成本限制、失败重试和生成资产记录符合预期。",
    checklist: [
      "Confirm image model API key, model name, and daily image call limit in Settings.",
      "Generate a small batch of 1-3 images before raising limits.",
      "Verify generated images are saved as assets and can be selected in Post Studio.",
      "Verify failed image calls do not retry indefinitely.",
      "Verify cost and usage expectations before running a larger batch."
    ],
    evidenceFields: [
      { key: "imageModel", label: "Image model", example: "gemini-2.5-flash-image", required: true },
      { key: "batchSize", label: "Batch size", example: "3", required: true },
      { key: "assetIds", label: "Generated asset IDs", example: "asset_001, asset_002", required: true },
      { key: "retryBehavior", label: "Retry behavior", example: "failed calls stop within configured retry limit", required: true },
      { key: "costLimit", label: "Cost or quota check", example: "dailyImageCallLimit respected", required: true }
    ],
    canBeAutomated: false
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

export function buildAcceptanceDeliverySummary(status: AcceptanceStatus = buildAcceptanceStatus()): AcceptanceDeliverySummary {
  const nextGate = status.manualGates[0] ?? null;
  const safeCommand =
    status.recommendedCommands.find((command) => command === "npm run smoke:safe") ??
    status.recommendedCommands[0] ??
    "npm run verify";

  return {
    headline: status.canMarkComplete ? "项目已完成全部验收" : "项目主体已就绪，仍保留真实外部动作闸门",
    stateLabel: status.canMarkComplete ? "可标记完成" : "仍需人工外部验收",
    completionLine: `当前完成度 ${status.completionPercent}%`,
    verifiedLine: `已自动覆盖 ${status.verified.length} 项核心能力`,
    manualGateLine: status.manualGates.length
      ? `仍有 ${status.manualGates.length} 项必须人工确认：${status.manualGates.map((gate) => gate.label).join("、")}`
      : "没有剩余人工闸门",
    nextManualGateId: nextGate?.id ?? null,
    nextSafeCommand: safeCommand,
    safeToAutomateCompletion: status.canMarkComplete && status.manualGates.length === 0
  };
}

export function buildAcceptanceEvidencePackage(
  status: AcceptanceStatus = buildAcceptanceStatus(),
  generatedAt = "manual-validation-template"
): AcceptanceEvidencePackage {
  return {
    schemaVersion: 1,
    generatedAt,
    purpose: "Manual external validation template for the remaining Xiaohongshu publish, schedule, multi-account, and image generation gates.",
    completionPercent: status.completionPercent,
    canMarkComplete: status.canMarkComplete,
    commands: status.recommendedCommands,
    gates: status.manualGates.map((gate) => ({
      id: gate.id,
      label: gate.label,
      guide: gate.guide,
      proofRequired: gate.proofRequired,
      checklist: gate.checklist,
      evidenceFields: gate.evidenceFields,
      evidenceRecordTemplate: Object.fromEntries([
        ["validated", false],
        ["validatedAt", ""],
        ["operator", ""],
        ["notes", ""],
        ...gate.evidenceFields.map((field) => [field.key, field.example] as const)
      ]) as Record<string, string | boolean>,
      manualOnly: true
    }))
  };
}
