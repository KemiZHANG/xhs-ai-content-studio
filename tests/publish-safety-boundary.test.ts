import { describe, expect, it } from "vitest";
import { buildPublishSafetyBoundary } from "@/app/components/publish-safety-boundary";

describe("publish safety boundary", () => {
  it("makes clear that a ready state only creates a confirmation sheet", () => {
    const boundary = buildPublishSafetyBoundary({
      publishReady: true,
      hasPendingConfirmation: false,
      modeLabel: "立即发布",
      blockerCount: 0
    });

    expect(boundary.state).toBe("ready");
    expect(boundary.headline).toContain("只会生成确认单");
    expect(boundary.detail).toContain("不会把内容发到小红书");
    expect(boundary.checkpoints).toContain("保留人工确认");
  });

  it("states that a pending confirmation still cannot call MCP before review", () => {
    const boundary = buildPublishSafetyBoundary({
      publishReady: true,
      hasPendingConfirmation: true,
      modeLabel: "定时发布",
      blockerCount: 0
    });

    expect(boundary.state).toBe("pending");
    expect(boundary.detail).toContain("确认前不会调用小红书 MCP");
    expect(boundary.checkpoints).toEqual(["核对账号", "核对可见范围", "核对图片版本", "核对发布时间"]);
  });

  it("summarizes blockers before publish confirmation is allowed", () => {
    const boundary = buildPublishSafetyBoundary({
      publishReady: false,
      hasPendingConfirmation: false,
      modeLabel: "立即发布",
      blockerCount: 3
    });

    expect(boundary.state).toBe("blocked");
    expect(boundary.detail).toContain("3 个发布前阻塞项");
    expect(boundary.checkpoints).toContain("通过 Quality Gate");
  });
});
