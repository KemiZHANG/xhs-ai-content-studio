import type { PostStage } from "@/lib/post-project/types";

export type StudioPage = "research" | "compose" | "visuals" | "publish";

export interface StudioDestination {
  page: StudioPage;
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
}

const researchDestination: StudioDestination = {
  page: "research",
  eyebrow: "第一步 · 研究",
  title: "先确定内容方向",
  description: "输入主题，整理受众、证据和可用角度。",
  actionLabel: "开始研究"
};

const copyDestination: StudioDestination = {
  page: "compose",
  eyebrow: "第二步 · 文案",
  title: "把研究变成文案",
  description: "集中编辑标题、正文和标签，完成后再处理图片。",
  actionLabel: "编辑文案"
};

const visualDestination: StudioDestination = {
  page: "visuals",
  eyebrow: "第三步 · 图片",
  title: "为文案选择画面",
  description: "整理参考图、生成图片，并确认最终图片版本。",
  actionLabel: "选择图片"
};

const publishDestination: StudioDestination = {
  page: "publish",
  eyebrow: "第四步 · 发布",
  title: "最后核对一次",
  description: "检查账号、可见范围、图片和发布时间。",
  actionLabel: "检查发布"
};

export function getStudioDestination(stage: PostStage): StudioDestination {
  switch (stage) {
    case "empty":
    case "briefing":
    case "researching":
      return researchDestination;
    case "evidence_ready":
    case "brief_ready":
    case "copy_drafting":
      return copyDestination;
    case "copy_ready":
    case "visual_planning":
    case "image_prompt_ready":
    case "image_generating":
      return visualDestination;
    case "image_ready":
    case "assembling":
    case "reviewing":
    case "scheduled":
    case "published":
      return publishDestination;
    case "failed":
      return {
        ...researchDestination,
        eyebrow: "需要处理",
        title: "从上一步重新开始",
        description: "检查当前项目后，重新运行未完成的阶段。",
        actionLabel: "返回研究"
      };
  }
}
