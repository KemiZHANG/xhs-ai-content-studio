import type { PostVersionDiffReport, PostVersionStatus } from "@/lib/post-project/versioning";

export type CanvasVersionDisplay = {
  tone: "ok" | "warn" | "neutral";
  label: string;
  detail: string;
  actionLabel?: string;
  changedLabels: string[];
  lanes: Array<{
    id: "copy" | "images" | "final";
    label: string;
    value: string;
    state: "ok" | "warn" | "empty";
  }>;
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
      changedLabels: [],
      lanes: emptyVersionLanes()
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
      changedLabels,
      lanes: buildVersionLanes(status, changedLabels)
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
      changedLabels,
      lanes: buildVersionLanes(status, changedLabels)
    };
  }

  if (status.finalPostMatchesCanvas) {
    return {
      tone: "warn",
      label: "待刷新发布检查",
      detail: "最终帖子已组装，但 Quality Gate 还没基于当前版本通过。发布前需要重新检查。",
      actionLabel: "进入发布检查",
      changedLabels,
      lanes: buildVersionLanes(status, changedLabels)
    };
  }

  return {
    tone: "neutral",
    label: "待组装最终帖子",
    detail: status.summary,
    actionLabel: "进入发布装配",
    changedLabels,
    lanes: buildVersionLanes(status, changedLabels)
  };
}

function emptyVersionLanes(): CanvasVersionDisplay["lanes"] {
  return [
    { id: "copy", label: "文案版本", value: "待生成", state: "empty" },
    { id: "images", label: "图片版本", value: "待选择", state: "empty" },
    { id: "final", label: "最终稿", value: "待组装", state: "empty" }
  ];
}

function buildVersionLanes(status: PostVersionStatus, changedLabels: string[]): CanvasVersionDisplay["lanes"] {
  const copyChanged = !status.qualityGateFresh && changedLabels.some((label) => ["标题", "正文", "标签"].includes(label));
  const imageChanged = !status.qualityGateFresh && changedLabels.some((label) => ["图片", "图片 Prompt"].includes(label));
  return [
    {
      id: "copy",
      label: "文案版本",
      value: status.activeCopyVersionId ?? "待生成",
      state: status.activeCopyVersionId ? copyChanged ? "warn" : "ok" : "empty"
    },
    {
      id: "images",
      label: "图片版本",
      value: status.activeImagePromptVersionIds.length
        ? `Prompt ${status.activeImagePromptVersionIds.length} 个`
        : "Prompt 待生成",
      state: status.activeImagePromptVersionIds.length ? imageChanged ? "warn" : "ok" : "empty"
    },
    {
      id: "final",
      label: "最终稿",
      value: status.qualityGateFresh
        ? "已锁定"
        : status.finalPostMatchesCanvas
          ? "待检查"
          : status.needsReassemble
            ? "需重新组装"
            : "待组装",
      state: status.qualityGateFresh ? "ok" : status.finalPostMatchesCanvas || status.needsReassemble ? "warn" : "empty"
    }
  ];
}
