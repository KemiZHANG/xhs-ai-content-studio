import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/acceptance/status/route";
import { buildAcceptanceDeliverySummary, buildAcceptanceStatus } from "@/lib/acceptance/status";

describe("acceptance status", () => {
  it("keeps completion honest while external gates remain manual", () => {
    const status = buildAcceptanceStatus();

    expect(status.completionPercent).toBe(98);
    expect(status.canMarkComplete).toBe(false);
    expect(status.summary).toContain("真实外部账号动作验收");
    expect(status.verified.map((item) => item.id)).toEqual([
      "post_project",
      "post_studio",
      "agent_director",
      "creative_brief",
      "viral_rag",
      "publish_safety"
    ]);
    expect(status.manualGates.map((item) => item.id)).toEqual([
      "real_publish",
      "scheduled_publish",
      "multi_account_switching",
      "large_scale_image_generation"
    ]);
    expect(status.manualGates.every((gate) => gate.canBeAutomated === false)).toBe(true);
    expect(status.manualGates.every((gate) => gate.proofRequired.length > 20)).toBe(true);
    expect(status.manualGates.every((gate) => gate.checklist.length >= 5)).toBe(true);
    expect(status.manualGates.find((gate) => gate.id === "real_publish")?.checklist).toContain(
      "Create a private visibility publish confirmation in Post Studio."
    );
    expect(status.manualGates.find((gate) => gate.id === "multi_account_switching")?.checklist).toContain(
      "Verify the old publish confirmation is invalidated and a new confirmation is required."
    );
  });

  it("points manual gates to safe acceptance guides and smoke commands", () => {
    const status = buildAcceptanceStatus();

    expect(status.recommendedCommands).toContain("npm run verify");
    expect(status.recommendedCommands).toContain("npm run smoke:safe");
    expect(status.recommendedCommands).toContain("npm run smoke:accounts");
    expect(status.manualGates.find((gate) => gate.id === "real_publish")?.guide).toBe("docs/real-publish-acceptance.md");
    expect(status.manualGates.find((gate) => gate.id === "multi_account_switching")?.guide).toBe("docs/multi-account-acceptance.md");
    expect(status.manualGates.find((gate) => gate.id === "real_publish")?.firstSafeStep).toContain("仅自己可见");
    expect(status.manualGates.find((gate) => gate.id === "real_publish")?.proofRequired).toContain("Publish History");
    expect(status.manualGates.find((gate) => gate.id === "multi_account_switching")?.proofRequired).toContain("旧确认单失效");
  });

  it("builds a delivery summary that cannot hide remaining manual gates", () => {
    const summary = buildAcceptanceDeliverySummary();

    expect(summary.headline).toContain("真实外部动作闸门");
    expect(summary.stateLabel).toBe("仍需人工外部验收");
    expect(summary.completionLine).toBe("当前完成度 98%");
    expect(summary.verifiedLine).toContain("6 项核心能力");
    expect(summary.manualGateLine).toContain("真实发布到小红书");
    expect(summary.nextManualGateId).toBe("real_publish");
    expect(summary.nextSafeCommand).toBe("npm run smoke:safe");
    expect(summary.safeToAutomateCompletion).toBe(false);
  });

  it("exposes a read-only API contract for frontend status panels", async () => {
    const response = await GET();
    const payload = await response.json() as {
      ok: boolean;
      status: ReturnType<typeof buildAcceptanceStatus>;
      deliverySummary: ReturnType<typeof buildAcceptanceDeliverySummary>;
    };

    expect(payload.ok).toBe(true);
    expect(payload.status.completionPercent).toBe(98);
    expect(payload.status.canMarkComplete).toBe(false);
    expect(payload.status.manualGates.length).toBeGreaterThanOrEqual(3);
    expect(payload.status.manualGates[0]?.checklist.length).toBeGreaterThanOrEqual(5);
    expect(payload.deliverySummary.completionLine).toBe("当前完成度 98%");
    expect(payload.deliverySummary.nextSafeCommand).toBe("npm run smoke:safe");
    expect(payload.deliverySummary.safeToAutomateCompletion).toBe(false);
  });
});
