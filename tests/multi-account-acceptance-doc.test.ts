import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path: string) => readFileSync(join(root, path), "utf8");

describe("multi-account acceptance documentation", () => {
  it("documents the safe multi-account MCP model", () => {
    const guide = readText("docs/multi-account-acceptance.md");

    expect(guide).toContain("一个 Xiaohongshu MCP 服务通常只对应一个小红书登录会话");
    expect(guide).toContain("18060");
    expect(guide).toContain("18061");
    expect(guide).toContain("18062");
    expect(guide).toContain("切换账号后，旧的发布确认单必须重新生成");
    expect(guide).toContain("检测当前账号");
    expect(guide).toContain("Publish History");
    expect(guide).toContain("仅自己可见");
    expect(guide).toContain("Completion Evidence / 完成证据");
    expect(guide).toContain("At least two real Xiaohongshu accounts are logged in through independent MCP URLs");
    expect(guide).toContain("Switching from account A to account B invalidates the old publish confirmation");
    expect(guide).toContain("audit record stores the correct account ID when available");
    expect(guide).toContain("cannot be marked as automated completion");
  });

  it("keeps account and publish smoke checks explicit", () => {
    const guide = readText("docs/multi-account-acceptance.md");

    expect(guide).toContain("npm run smoke:accounts");
    expect(guide).toContain("npm run smoke:publish-dry-run");
    expect(guide).toContain("npm run smoke:safe");
    expect(guide).toContain("不会切换账号、不搜索、不生成图片、不发布、不定时");
    expect(guide).toContain("These checks do not publish");
  });

  it("links README and completion matrix to the guide", () => {
    const readme = readText("README.md");
    const matrix = readText("docs/goal-completion-matrix.md");

    expect(readme).toContain("[多账号验收指南](docs/multi-account-acceptance.md)");
    expect(readme).toContain("[multi-account acceptance guide](docs/multi-account-acceptance.md)");
    expect(matrix).toContain("docs/multi-account-acceptance.md");
    expect(matrix).toContain("当前估计完成度：**98%**");
  });
});
