import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PostStudioSideNavigator } from "@/app/components/post-studio-side-navigator";
import type { PostSideDigest } from "@/app/components/post-side-digest";
import { buildStudioTabGroups } from "@/app/components/studio-tab-groups";

const sideDigest: PostSideDigest = {
  headline: "先处理：图片素材",
  detail: "默认只展示关键证据、当前图片和发布阻塞项。",
  primaryTab: "generated",
  primaryLabel: "去处理：图片素材",
  primaryReason: "已有生成图，先选择发布图片。",
  cards: [
    {
      id: "evidence",
      label: "证据策略",
      value: "8 条规律",
      detail: "实时 5 / 爆款库 3",
      state: "ready",
      tab: "insights"
    },
    {
      id: "assets",
      label: "图片素材",
      value: "待选图",
      detail: "已有生成图，先选发布图。",
      state: "warn",
      tab: "generated"
    },
    {
      id: "publish",
      label: "发布安全",
      value: "未就绪",
      detail: "先跑 Quality Gate。",
      state: "neutral",
      tab: "publish"
    },
    {
      id: "focus",
      label: "当前面板",
      value: "生成素材",
      detail: "原始数据默认收起。",
      state: "neutral",
      tab: "generated"
    }
  ]
};

describe("post studio side navigator", () => {
  it("renders compressed side digest and grouped tabs", () => {
    const html = renderToStaticMarkup(createElement(PostStudioSideNavigator, {
      activeTab: "generated",
      sideDigest,
      studioTabGroups: buildStudioTabGroups("generated"),
      onSelectTab: () => undefined
    }));

    expect(html).toContain("右侧工作区");
    expect(html).toContain("先处理：图片素材");
    expect(html).toContain("去处理：图片素材");
    expect(html).toContain("证据策略");
    expect(html).toContain("图片素材");
    expect(html).toContain("发布安全");
    expect(html).toContain("右侧工作区分组");
    expect(html).toContain("需求与证据");
    expect(html).toContain("文案与图片");
    expect(html).toContain("发布检查");
    expect(html).toContain("生成图");
  });
});
