export type PublishSafetyBoundaryInput = {
  publishReady: boolean;
  hasPendingConfirmation: boolean;
  modeLabel: string;
  blockerCount: number;
};

export type PublishSafetyBoundaryModel = {
  state: "ready" | "pending" | "blocked";
  headline: string;
  detail: string;
  checkpoints: string[];
};

export function buildPublishSafetyBoundary({
  publishReady,
  hasPendingConfirmation,
  modeLabel,
  blockerCount
}: PublishSafetyBoundaryInput): PublishSafetyBoundaryModel {
  if (hasPendingConfirmation) {
    return {
      state: "pending",
      headline: "确认单已生成，但还没有发布",
      detail: `${modeLabel}需要你在确认单里逐项核对。确认前不会调用小红书 MCP，也不会创建定时任务。`,
      checkpoints: ["核对账号", "核对可见范围", "核对图片版本", "核对发布时间"]
    };
  }

  if (publishReady) {
    return {
      state: "ready",
      headline: "下一步只会生成确认单",
      detail: "生成确认单不会把内容发到小红书。它只是锁定当前文案、图片、账号和时间，等待你最后确认。",
      checkpoints: ["锁定当前版本", "保留人工确认", "防止误发旧稿"]
    };
  }

  return {
    state: "blocked",
    headline: "还不能进入发布确认",
    detail: `当前还有 ${blockerCount} 个发布前阻塞项。先处理阻塞项，再生成确认单。`,
    checkpoints: ["补齐内容", "通过 Quality Gate", "确认账号登录"]
  };
}
