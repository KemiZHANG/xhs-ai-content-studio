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
    expect(html).toContain("文本模型已配置");
    expect(html).toContain("缺少图片模型");
    expect(html).toContain("当前草稿");
    expect(html).toContain("刷新 MCP 状态");
    expect(html).not.toContain("旧版 AI 工作台</span>");
    expect(html).not.toContain("高级主题研究</span>");
  });
});
