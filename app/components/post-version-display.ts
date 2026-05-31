import type { PostVersionDiffReport, PostVersionStatus } from "@/lib/post-project/versioning";

export type CanvasVersionDisplay = {
  tone: "ok" | "warn" | "neutral";
  label: string;
  detail: string;
  actionLabel?: string;
  changedLabels: string[];
};

export function buildCanvasVersionDisplay(
  status: PostVersionStatus | null,
  diff: PostVersionDiffReport | null
): CanvasVersionDisplay {
  if (!status) {
    return {
      tone: "neutral",
      label: "待生成最终帖子",
      detail: "先生成文案、选择图片，再把它们组装成同一篇待发布笔记。",
      actionLabel: "进入发布装配",
      changedLabels: []
    };
  }

  const changedLabels = diff?.changes
    .filter((item) => item.changed)
    .map((item) => item.label)
    .slice(0, 4) ?? [];

  if (status.qualityGateFresh) {
    return {
      tone: "ok",
      label: "最终帖子已锁定",
      detail: "当前文案、图片、Prompt 和 Quality Gate 一致，发布前仍需要人工确认账号、可见范围和时间。",
      changedLabels
    };
  }

  if (status.needsReassemble) {
    return {
      tone: "warn",
      label: "画布有新版本",
      detail: diff?.hasChanges
        ? `最终帖子快照已落后：${changedLabels.join("、") || diff.summary}。发布前请重新组装。`
        : status.summary,
      actionLabel: "重新组装帖子",
      changedLabels
    };
  }

  if (status.finalPostMatchesCanvas) {
    return {
      tone: "warn",
      label: "待刷新发布检查",
      detail: "最终帖子已组装，但 Quality Gate 还没基于当前版本通过。发布前需要重新检查。",
      actionLabel: "进入发布检查",
      changedLabels
    };
  }

  return {
    tone: "neutral",
    label: "待组装最终帖子",
    detail: status.summary,
    actionLabel: "进入发布装配",
    changedLabels
  };
}
