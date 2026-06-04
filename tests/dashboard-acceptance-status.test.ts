import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Dashboard } from "@/app/components/xhs-panels";

describe("dashboard acceptance status", () => {
  it("surfaces compact delivery status without opening Settings", () => {
    const html = renderToStaticMarkup(createElement(Dashboard, {
      health: null,
      modelReady: true,
      imageReady: false,
      latestRun: undefined,
      busy: null,
      onRefresh: () => undefined
    }));

    expect(html).toContain("交付状态");
    expect(html).toContain("当前完成度 99%");
    expect(html).toContain("内部闭环可交付");
    expect(html).toContain("外部验收另行记录");
    expect(html).toContain("真实发布到小红书");
    expect(html).toContain("npm run smoke:safe");
  });
});
