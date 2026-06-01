export type VersionSwitchGuidanceInput = {
  kind: "copy" | "prompt";
  hasPublishPlan: boolean;
  qualityGateFresh: boolean;
  finalPostExists: boolean;
};

export type VersionSwitchGuidance = {
  label: string;
  detail: string;
  state: "neutral" | "warn";
};

export function buildVersionSwitchGuidance({
  kind,
  hasPublishPlan,
  qualityGateFresh,
  finalPostExists
}: VersionSwitchGuidanceInput): VersionSwitchGuidance {
  const target = kind === "copy" ? "文案版本" : "图片 Prompt 版本";
  if (hasPublishPlan) {
    return {
      label: "会撤销旧确认单",
      detail: `回滚${target}后，当前发布确认单会失效，需要重新保存画布并运行 Quality Gate。`,
      state: "warn"
    };
  }
  if (qualityGateFresh || finalPostExists) {
    return {
      label: "需要重新检查",
      detail: `切换${target}后，最终帖子快照会失效，发布前需要重新组装并检查。`,
      state: "warn"
    };
  }
  return {
    label: "只回填画布",
    detail: `切换${target}只会回填当前 PostProject，不会发布；后续仍需保存和发布检查。`,
    state: "neutral"
  };
}
