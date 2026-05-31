export type ResettableWorkflowForm = {
  topic: string;
  requirements: string;
  visibility: string;
  autoPublish: boolean;
  workflowGoal: string;
  publishMode: string;
  generateImages: boolean;
  scheduleAt: string;
  assetIds: string[];
  productName: string;
  sellingPoints: string;
  extraImagePrompt: string;
};

export type ProjectResetKind = "conversation" | "project";

export function resetWorkflowFormForNewProject<T extends ResettableWorkflowForm>(
  current: T,
  {
    topic,
    defaultVisibility
  }: {
    topic?: string;
    defaultVisibility: string;
  }
): T {
  return {
    ...current,
    topic: topic ?? "",
    requirements: "",
    visibility: defaultVisibility,
    autoPublish: false,
    workflowGoal: "research",
    publishMode: "draft",
    generateImages: false,
    scheduleAt: "",
    assetIds: [],
    productName: "",
    sellingPoints: "",
    extraImagePrompt: ""
  };
}

export function noticeForProjectReset(kind: ProjectResetKind): string {
  return kind === "conversation"
    ? "已开启干净的新帖子对话：当前项目的证据、草稿、图片选择和发布计划已清空。"
    : "已新建干净的帖子项目：研究证据、草稿、图片选择和发布计划已清空。";
}
