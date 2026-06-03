import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AcceptanceStatusPanel } from "@/app/components/acceptance-status-panel";

describe("acceptance status panel", () => {
  it("renders completion, verified coverage, and manual gates for Settings", () => {
    const html = renderToStaticMarkup(createElement(AcceptanceStatusPanel));

    expect(html).toContain("项目验收状态");
    expect(html).toContain("99%");
    expect(html).toContain("仍需人工外部验收");
    expect(html).toContain("已由代码和测试覆盖");
    expect(html).toContain("必须人工确认");
    expect(html).toContain("项目主体已就绪，仍保留真实外部动作闸门");
    expect(html).toContain("下一步安全命令");
    expect(html).toContain("完成证据");
    expect(html).toContain("必须人工验收");
    expect(html).toContain("验收证据包");
    expect(html).toContain("/api/acceptance/evidence-package · v1");
    expect(html).toContain("npm run acceptance:evidence-package");
    expect(html).toContain("npm run acceptance:validate-evidence");
    expect(html).toContain("不会调用 MCP、模型、发布或定时任务");
    expect(html).toContain("真实发布到小红书");
    expect(html).toContain("多个真实账号切换验收");
    expect(html).toContain("Create a private visibility publish confirmation in Post Studio.");
    expect(html).toContain("证据字段");
    expect(html).toContain("Publish receipt");
    expect(html).toContain("MCP URL");
    expect(html).toContain("Verify the old publish confirmation is invalidated and a new confirmation is required.");
    expect(html).toContain("Confirmation invalidation");
    expect(html).toContain("npm run smoke:safe");
    expect(html).toContain("docs/multi-account-acceptance.md");
  });
});
