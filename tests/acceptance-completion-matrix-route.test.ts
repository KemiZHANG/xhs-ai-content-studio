import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/acceptance/completion-matrix/route";
import type { buildAcceptanceCompletionMatrix } from "@/lib/acceptance/status";

describe("acceptance completion matrix route", () => {
  it("returns only the read-only machine-readable completion matrix", async () => {
    const response = await GET();
    const payload = await response.json() as {
      ok: boolean;
      completionMatrix: ReturnType<typeof buildAcceptanceCompletionMatrix>;
      status?: unknown;
      evidencePackage?: unknown;
      deliverySummary?: unknown;
    };

    expect(payload.ok).toBe(true);
    expect(payload.status).toBeUndefined();
    expect(payload.evidencePackage).toBeUndefined();
    expect(payload.deliverySummary).toBeUndefined();
    expect(payload.completionMatrix.completionPercent).toBe(99);
    expect(payload.completionMatrix.canMarkComplete).toBe(false);
    expect(payload.completionMatrix.automatedCoverage.map((item) => item.id)).toContain("post_studio");
    expect(payload.completionMatrix.manualExternalGates.map((gate) => gate.id)).toEqual([
      "real_publish",
      "scheduled_publish",
      "multi_account_switching",
      "large_scale_image_generation"
    ]);
    expect(payload.completionMatrix.remainingWork[0]?.id).toBe("real_publish");
    expect(payload.completionMatrix.manualExternalGates.every((gate) => gate.canBeAutomated === false)).toBe(true);
  });
});
