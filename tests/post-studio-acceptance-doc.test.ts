import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path: string) => readFileSync(join(root, path), "utf8");

describe("post studio acceptance documentation", () => {
  it("links the README to the concrete Post Studio acceptance checklist", () => {
    const readme = readText("README.md");

    expect(readme).toContain("[Post Studio 验收清单](docs/post-studio-acceptance.md)");
    expect(readme).toContain("[Post Studio acceptance checklist](docs/post-studio-acceptance.md)");
    expect(readme).toContain("真实发布和定时发布需要你明确授权后再测试");
    expect(readme).toContain("explicit user authorization");
    expect(readme).toContain("/api/health/mcp");
    expect(readme).toContain("X-XHS-Action-Token");
    expect(readme).toContain("npm run smoke:safe");
    expect(readme).toContain("npm run smoke:local");
    expect(readme).toContain("npm run smoke:research");
    expect(readme).toContain("npm run smoke:publish-dry-run");
    expect(readme).toContain("Post Studio 常用指令");
    expect(readme).toContain("Useful Post Studio Prompts");
    expect(readme).toContain("真实发布仍需要在发布检查区人工确认");
    expect(readme).toContain("[真实发布验收指南](docs/real-publish-acceptance.md)");
    expect(readme).toContain("[real publishing acceptance guide](docs/real-publish-acceptance.md)");
    expect(readme).toContain("[目标完成矩阵](docs/goal-completion-matrix.md)");
    expect(readme).toContain("[goal completion matrix](docs/goal-completion-matrix.md)");
  });

  it("keeps the goal completion matrix honest about remaining external validation", () => {
    const matrix = readText("docs/goal-completion-matrix.md");

    expect(matrix).toContain("统一 PostProject");
    expect(matrix).toContain("Post Studio 三栏创作台");
    expect(matrix).toContain("Viral Knowledge Base / 爆款库");
    expect(matrix).toContain("发布 dry-run 安全 smoke");
    expect(matrix).toContain("当前估计完成度：**96%-97%**");
    expect(matrix).toContain("真实发布到小红书");
    expect(matrix).toContain("真实定时发布到小红书");
    expect(matrix).toContain("多账号真实切换");
    expect(matrix).toContain("不能标记为 100%");
  });

  it("documents real publishing as a manual confirmation flow", () => {
    const guide = readText("docs/real-publish-acceptance.md");

    expect(guide).toContain("默认情况下，XHS AI Content Studio 只会生成发布确认单");
    expect(guide).toContain("仅自己可见");
    expect(guide).toContain("确认前不会调用小红书发布");
    expect(guide).toContain("点击确认后才会调用小红书 MCP 的发布能力");
    expect(guide).toContain("不要绕过 Post Studio 直接调用发布接口");
    expect(guide).toContain("Only the final manual confirmation triggers the Xiaohongshu MCP publishing action");
  });

  it("keeps the acceptance checklist aligned with the product-level goal", () => {
    const checklist = readText("docs/post-studio-acceptance.md");
    const requiredSections = [
      "新建 PostProject",
      "真实研究与证据",
      "爆款库 RAG",
      "CreativeBrief、文案和图片方向",
      "图片与图文卡片",
      "组装最终帖子",
      "Quality Gate",
      "发布确认"
    ];

    for (const section of requiredSections) {
      expect(checklist).toContain(section);
    }

    expect(checklist).toContain("旧证据、旧草稿、旧图片和旧发布计划不会自动带入");
    expect(checklist).toContain("sourceType: \"viral_library\"");
    expect(checklist).toContain("basedOnEvidenceIds");
    expect(checklist).toContain("真实发布闸门");
    expect(checklist).toContain("确认前不会调用小红书 MCP");
    expect(checklist).toContain("自动发布默认关闭");
    expect(checklist).toContain("reachable: true");
    expect(checklist).toContain("fetch failed");
    expect(checklist).toContain("npm run smoke:safe");
    expect(checklist).toContain("npm run smoke:local");
    expect(checklist).toContain("npm run smoke:research");
    expect(checklist).toContain("npm run smoke:publish-dry-run");
    expect(checklist).toContain("把这些高质量样本保存到爆款库");
    expect(checklist).toContain("基于当前 CreativeBrief 生成原创文案");
  });
});
