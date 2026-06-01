import { describe, expect, it } from "vitest";
import { buildVersionSwitchGuidance } from "@/app/components/version-switch-guidance";

describe("version switch guidance", () => {
  it("warns that switching versions cancels an existing publish confirmation", () => {
    const guidance = buildVersionSwitchGuidance({
      kind: "copy",
      hasPublishPlan: true,
      qualityGateFresh: true,
      finalPostExists: true
    });

    expect(guidance.state).toBe("warn");
    expect(guidance.label).toBe("会撤销旧确认单");
    expect(guidance.detail).toContain("发布确认单会失效");
    expect(guidance.detail).toContain("重新保存画布");
  });

  it("warns that prompt rollback invalidates final post checks", () => {
    const guidance = buildVersionSwitchGuidance({
      kind: "prompt",
      hasPublishPlan: false,
      qualityGateFresh: true,
      finalPostExists: true
    });

    expect(guidance.state).toBe("warn");
    expect(guidance.label).toBe("需要重新检查");
    expect(guidance.detail).toContain("图片 Prompt 版本");
    expect(guidance.detail).toContain("最终帖子快照会失效");
  });

  it("keeps ordinary version switches framed as canvas-only changes", () => {
    const guidance = buildVersionSwitchGuidance({
      kind: "copy",
      hasPublishPlan: false,
      qualityGateFresh: false,
      finalPostExists: false
    });

    expect(guidance.state).toBe("neutral");
    expect(guidance.label).toBe("只回填画布");
    expect(guidance.detail).toContain("不会发布");
  });
});
