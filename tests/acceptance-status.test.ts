import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/acceptance/status/route";
import {
  buildAcceptanceCompletionMatrix,
  buildAcceptanceDeliverySummary,
  buildAcceptanceEvidencePackage,
  buildAcceptanceStatus
} from "@/lib/acceptance/status";

describe("acceptance status", () => {
  it("keeps completion honest while external gates remain manual", () => {
    const status = buildAcceptanceStatus();

    expect(status.completionPercent).toBe(99);
    expect(status.canMarkComplete).toBe(false);
    expect(status.roughDeliveryReady).toBe(true);
    expect(status.summary).toContain("可先粗略交付使用");
    expect(status.summary).toContain("外部验收闸门");
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
    expect(status.manualGates.every((gate) => gate.evidenceFields.length >= 5)).toBe(true);
    expect(status.manualGates.every((gate) => gate.evidenceFields.every((field) => field.required))).toBe(true);
    expect(status.manualGates.find((gate) => gate.id === "real_publish")?.checklist).toContain(
      "Create a private visibility publish confirmation in Post Studio."
    );
    expect(status.manualGates.find((gate) => gate.id === "real_publish")?.evidenceFields.map((field) => field.key)).toContain("publishReceipt");
    expect(status.manualGates.find((gate) => gate.id === "multi_account_switching")?.checklist).toContain(
      "Verify the old publish confirmation is invalidated and a new confirmation is required."
    );
    expect(status.manualGates.find((gate) => gate.id === "multi_account_switching")?.evidenceFields.map((field) => field.key)).toContain("confirmationInvalidation");
  });

  it("points manual gates to safe acceptance guides and smoke commands", () => {
    const status = buildAcceptanceStatus();

    expect(status.recommendedCommands).toContain("npm run verify");
    expect(status.recommendedCommands).toContain("npm run smoke:safe");
    expect(status.recommendedCommands).toContain("npm run smoke:accounts");
    expect(status.recommendedCommands).toContain("npm run smoke:internal-delivery");
    expect(status.recommendedCommands).toContain("npm run acceptance:status");
    expect(status.recommendedCommands).toContain("npm run acceptance:evidence-package");
    expect(status.recommendedCommands).toContain("npm run acceptance:validate-evidence");
    expect(status.recommendedCommands).toContain("npm run acceptance:record-evidence");
    expect(status.recommendedCommands).toContain("npm run acceptance:export-records");
    expect(status.manualGates.find((gate) => gate.id === "real_publish")?.guide).toBe("docs/real-publish-acceptance.md");
    expect(status.manualGates.find((gate) => gate.id === "multi_account_switching")?.guide).toBe("docs/multi-account-acceptance.md");
    expect(status.manualGates.find((gate) => gate.id === "real_publish")?.firstSafeStep).toContain("仅自己可见");
    expect(status.manualGates.find((gate) => gate.id === "real_publish")?.proofRequired).toContain("Publish History");
    expect(status.manualGates.find((gate) => gate.id === "multi_account_switching")?.proofRequired).toContain("旧确认单失效");
  });

  it("builds a delivery summary that cannot hide remaining manual gates", () => {
    const summary = buildAcceptanceDeliverySummary();

    expect(summary.headline).toContain("内部创作闭环可交付");
    expect(summary.stateLabel).toBe("内部闭环可交付");
    expect(summary.completionLine).toBe("当前完成度 99%");
    expect(summary.verifiedLine).toContain("6 项核心能力");
    expect(summary.manualGateLine).toContain("外部验收另行记录");
    expect(summary.manualGateLine).toContain("真实发布到小红书");
    expect(summary.nextManualGateId).toBe("real_publish");
    expect(summary.nextSafeCommand).toBe("npm run smoke:safe");
    expect(summary.safeToAutomateCompletion).toBe(false);
  });

  it("builds a manual evidence package for the remaining external gates", () => {
    const evidencePackage = buildAcceptanceEvidencePackage(buildAcceptanceStatus(), "2026-06-03T00:00:00.000Z");

    expect(evidencePackage.schemaVersion).toBe(1);
    expect(evidencePackage.generatedAt).toBe("2026-06-03T00:00:00.000Z");
    expect(evidencePackage.canMarkComplete).toBe(false);
    expect(evidencePackage.purpose).toContain("Manual external validation template");
    expect(evidencePackage.validationRecordEndpoint).toBe("/api/acceptance/validation-records");
    expect(evidencePackage.dryRunCommand).toBe("node scripts/import-acceptance-validation-records.mjs --dry-run");
    expect(evidencePackage.commands).toEqual(expect.arrayContaining([
      "npm run acceptance:evidence-package",
      "npm run acceptance:validate-evidence",
      "npm run acceptance:record-evidence",
      "npm run acceptance:export-records"
    ]));
    expect(evidencePackage.gates.map((gate) => gate.id)).toEqual([
      "real_publish",
      "scheduled_publish",
      "multi_account_switching",
      "large_scale_image_generation"
    ]);
    expect(evidencePackage.gates.every((gate) => gate.manualOnly)).toBe(true);
    expect(evidencePackage.gates.find((gate) => gate.id === "real_publish")?.evidenceRecordTemplate).toMatchObject({
      validated: false,
      validatedAt: "",
      operator: "",
      publishReceipt: "published receipt id or MCP response summary"
    });
  });

  it("builds a machine-readable completion matrix from the same status source", () => {
    const matrix = buildAcceptanceCompletionMatrix(buildAcceptanceStatus(), "2026-06-03T00:00:00.000Z");

    expect(matrix.generatedAt).toBe("2026-06-03T00:00:00.000Z");
    expect(matrix.completionPercent).toBe(99);
    expect(matrix.canMarkComplete).toBe(false);
    expect(matrix.automatedCoverage.map((item) => item.id)).toEqual([
      "post_project",
      "post_studio",
      "agent_director",
      "creative_brief",
      "viral_rag",
      "publish_safety"
    ]);
    expect(matrix.automatedCoverage.every((item) => item.status === "verified")).toBe(true);
    expect(matrix.manualExternalGates.map((gate) => gate.id)).toEqual([
      "real_publish",
      "scheduled_publish",
      "multi_account_switching",
      "large_scale_image_generation"
    ]);
    expect(matrix.manualExternalGates.every((gate) => gate.status === "pending_manual_validation")).toBe(true);
    expect(matrix.manualExternalGates.every((gate) => gate.canBeAutomated === false)).toBe(true);
    expect(matrix.manualExternalGates.find((gate) => gate.id === "real_publish")?.evidenceFields).toContain("publishReceipt");
    expect(matrix.remainingWork.map((item) => item.id)).toEqual([
      "real_publish",
      "scheduled_publish",
      "multi_account_switching",
      "large_scale_image_generation"
    ]);
    expect(matrix.recommendedCommands).toContain("npm run acceptance:status");
    expect(matrix.recommendedCommands).toContain("npm run acceptance:export-records");
  });

  it("exposes a read-only API contract for frontend status panels", async () => {
    const response = await GET();
    const payload = await response.json() as {
      ok: boolean;
      status: ReturnType<typeof buildAcceptanceStatus>;
      deliverySummary: ReturnType<typeof buildAcceptanceDeliverySummary>;
      evidencePackage: ReturnType<typeof buildAcceptanceEvidencePackage>;
      completionMatrix: ReturnType<typeof buildAcceptanceCompletionMatrix>;
    };

    expect(payload.ok).toBe(true);
    expect(payload.status.completionPercent).toBe(99);
    expect(payload.status.canMarkComplete).toBe(false);
    expect(payload.status.roughDeliveryReady).toBe(true);
    expect(payload.status.manualGates.length).toBeGreaterThanOrEqual(3);
    expect(payload.status.manualGates[0]?.checklist.length).toBeGreaterThanOrEqual(5);
    expect(payload.status.manualGates[0]?.evidenceFields.length).toBeGreaterThanOrEqual(5);
    expect(payload.deliverySummary.completionLine).toBe("当前完成度 99%");
    expect(payload.deliverySummary.stateLabel).toBe("内部闭环可交付");
    expect(payload.deliverySummary.nextSafeCommand).toBe("npm run smoke:safe");
    expect(payload.deliverySummary.safeToAutomateCompletion).toBe(false);
    expect(payload.evidencePackage.schemaVersion).toBe(1);
    expect(payload.evidencePackage.validationRecordEndpoint).toBe("/api/acceptance/validation-records");
    expect(payload.evidencePackage.dryRunCommand).toBe("node scripts/import-acceptance-validation-records.mjs --dry-run");
    expect(payload.evidencePackage.gates[0]?.evidenceRecordTemplate).toHaveProperty("validated", false);
    expect(payload.evidencePackage.gates[0]?.manualOnly).toBe(true);
    expect(payload.completionMatrix.completionPercent).toBe(99);
    expect(payload.completionMatrix.remainingWork[0]?.id).toBe("real_publish");
    expect(payload.completionMatrix.manualExternalGates.every((gate) => gate.canBeAutomated === false)).toBe(true);
    expect(payload.completionMatrix.recommendedCommands).toContain("npm run acceptance:export-records");
  });
});
