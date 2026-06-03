import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AcceptanceStatusPanel } from "@/app/components/acceptance-status-panel";

describe("acceptance status panel", () => {
  it("renders completion, verified coverage, and manual gates for Settings", () => {
    const html = renderToStaticMarkup(createElement(AcceptanceStatusPanel));

    expect(html).toContain("项目验收状态");
    expect(html).toContain("98%");
    expect(html).toContain("仍需人工外部验收");
    expect(html).toContain("已由代码和测试覆盖");
    expect(html).toContain("必须人工确认");
    expect(html).toContain("项目主体已就绪，仍保留真实外部动作闸门");
    expect(html).toContain("下一步安全命令");
    expect(html).toContain("完成证据");
    expect(html).toContain("必须人工验收");
    expect(html).toContain("真实发布到小红书");
    expect(html).toContain("多个真实账号切换验收");
    expect(html).toContain("npm run smoke:safe");
    expect(html).toContain("docs/multi-account-acceptance.md");
  });
});
