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
    label: "研究与证据",
    detail: "可学习结论、研究证据、爆款库 RAG",
    tabs: [
      { id: "insights", label: "可学习结论" },
      { id: "brief", label: "CreativeBrief" },
      { id: "evidence", label: "研究证据" },
      { id: "viral", label: "爆款库" }
    ]
  },
  {
    id: "creation",
    label: "图片与素材",
    detail: "图片参考、已生成素材",
    tabs: [
      { id: "references", label: "图片参考" },
      { id: "generated", label: "已生成素材" }
    ]
  },
  {
    id: "publish",
    label: "发布检查",
    detail: "Quality Gate、账号、确认单",
    tabs: [{ id: "publish", label: "发布检查" }]
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
