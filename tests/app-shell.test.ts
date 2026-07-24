import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/app/components/app-shell";
import { defaultSettings } from "@/app/config/default-settings";

describe("app shell", () => {
  it("presents the creation flow before management tools", () => {
    const html = renderToStaticMarkup(createElement(AppShell, {
      section: "workspace",
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

    expect(html).toContain("内容工作室");
    expect(html).toContain("你的创作任务中心");
    expect(html).toContain("工作台");
    expect(html).toContain("研究");
    expect(html).toContain("文案");
    expect(html).toContain("图片");
    expect(html).toContain("发布");
    expect(html).toContain("资料库");
    expect(html).toContain("任务");
    expect(html).toContain("发布记录");
    expect(html).toContain("设置");
    expect(html).toContain("文案模型可用");
    expect(html).toContain("图片模型未配置");
  });

  it("shows page-specific guidance without dashboard counters", () => {
    const html = renderToStaticMarkup(createElement(AppShell, {
      section: "compose",
      settings: defaultSettings,
      health: null,
      settingsBusy: null,
      modelReady: true,
      imageReady: true,
      jobs: [],
      assets: [],
      currentDraft: null,
      notice: "",
      onNavigate: () => undefined,
      onRefreshHealth: () => undefined,
      onSwitchAccount: () => undefined,
      children: createElement("div", null, "content")
    }));

    expect(html).toContain("集中完成标题、正文和标签");
    expect(html).not.toContain("运行中");
    expect(html).not.toContain("当前草稿");
  });
});
