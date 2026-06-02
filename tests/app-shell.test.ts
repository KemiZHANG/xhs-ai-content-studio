import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/app/components/app-shell";
import { defaultSettings } from "@/app/config/default-settings";

describe("app shell", () => {
  it("keeps the main navigation focused on the four daily work areas", () => {
    const html = renderToStaticMarkup(createElement(AppShell, {
      section: "flow",
      settings: defaultSettings,
      health: null,
      settingsBusy: null,
      modelReady: true,
      imageReady: false,
      jobs: [],
      assets: [],
      currentDraft: null,
      notice: "",
      onNavigate: () => undefined,
      onRefreshHealth: () => undefined,
      onSwitchAccount: () => undefined,
      children: createElement("div", null, "content")
    }));

    expect(html).toContain("XHS AI Studio");
    expect(html).toContain("本地内容中台");
    expect(html).toContain("Post Studio");
    expect(html).toContain("Assets");
    expect(html).toContain("Publish History");
    expect(html).toContain("Settings");
    expect(html).toContain("日常主流程");
    expect(html).toContain("创作始终回到 Post Studio");
    expect(html).toContain("打开主工作台");
    expect(html).toContain("文本模型已配置");
    expect(html).toContain("缺少图片模型");
    expect(html).toContain("当前草稿");
    expect(html).toContain("刷新 MCP 状态");
    expect(html).not.toContain("旧版 AI 工作台</span>");
    expect(html).not.toContain("高级主题研究</span>");
  });

  it("shows a clear return-to-Post-Studio banner on legacy work areas", () => {
    const html = renderToStaticMarkup(createElement(AppShell, {
      section: "chat",
      settings: defaultSettings,
      health: null,
      settingsBusy: null,
      modelReady: true,
      imageReady: true,
      jobs: [],
      assets: [],
      currentDraft: null,
      notice: "",
      ribbon: createElement("div", null, "legacy ribbon"),
      onNavigate: () => undefined,
      onRefreshHealth: () => undefined,
      onSwitchAccount: () => undefined,
      children: createElement("div", null, "content")
    }));

    expect(html).toContain("旧版 AI 工作台");
    expect(html).toContain("主流程请回到 Post Studio");
    expect(html).toContain("新的创作导演 Agent 已集中到 Post Studio");
    expect(html).toContain("回到 Post Studio");
    expect(html).toContain("legacy ribbon");
  });
});
