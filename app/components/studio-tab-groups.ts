import type { PostStage } from "@/app/types";

export type StudioTabId = "insights" | "brief" | "evidence" | "viral" | "references" | "generated" | "publish";

export type StudioTabGroup = {
  id: "evidence" | "creation" | "publish";
  label: string;
  detail: string;
  active: boolean;
  tabs: Array<{
    id: StudioTabId;
    label: string;
    active: boolean;
  }>;
};

const groupDefinitions: Array<Omit<StudioTabGroup, "active" | "tabs"> & { tabs: Array<{ id: StudioTabId; label: string }> }> = [
  {
    id: "evidence",
    label: "需求与证据",
    detail: "研究、结论、爆款库",
    tabs: [
      { id: "insights", label: "结论" },
      { id: "brief", label: "Brief" },
      { id: "evidence", label: "样本" },
      { id: "viral", label: "爆款库" }
    ]
  },
  {
    id: "creation",
    label: "文案与图片",
    detail: "参考图、生成图",
    tabs: [
      { id: "references", label: "参考图" },
      { id: "generated", label: "生成图" }
    ]
  },
  {
    id: "publish",
    label: "发布检查",
    detail: "质量、账号、确认单",
    tabs: [{ id: "publish", label: "检查" }]
  }
];

export function buildStudioTabGroups(activeTab: StudioTabId): StudioTabGroup[] {
  return groupDefinitions.map((group) => {
    const tabs = group.tabs.map((tab) => ({
      ...tab,
      active: tab.id === activeTab
    }));

    return {
      id: group.id,
      label: group.label,
      detail: group.detail,
      active: tabs.some((tab) => tab.active),
      tabs
    };
  });
}

export function getRecommendedStudioTabForStage(stage: PostStage | undefined): StudioTabId {
  switch (stage) {
    case "brief_ready":
    case "copy_drafting":
    case "copy_ready":
    case "visual_planning":
    case "image_prompt_ready":
      return "brief";
    case "image_generating":
    case "image_ready":
      return "generated";
    case "assembling":
    case "reviewing":
    case "scheduled":
    case "published":
    case "failed":
      return "publish";
    case "empty":
    case "briefing":
    case "researching":
    case "evidence_ready":
    default:
      return "insights";
  }
}
