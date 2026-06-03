import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/acceptance/evidence-package/route";
import type { buildAcceptanceEvidencePackage } from "@/lib/acceptance/status";

describe("acceptance evidence package route", () => {
  it("returns only the read-only manual evidence package", async () => {
    const response = await GET();
    const payload = await response.json() as {
      ok: boolean;
      evidencePackage: ReturnType<typeof buildAcceptanceEvidencePackage>;
      status?: unknown;
      deliverySummary?: unknown;
    };

    expect(payload.ok).toBe(true);
    expect(payload.status).toBeUndefined();
    expect(payload.deliverySummary).toBeUndefined();
    expect(payload.evidencePackage.schemaVersion).toBe(1);
    expect(payload.evidencePackage.canMarkComplete).toBe(false);
    expect(payload.evidencePackage.gates.map((gate) => gate.id)).toEqual([
      "real_publish",
      "scheduled_publish",
      "multi_account_switching",
      "large_scale_image_generation"
    ]);
    expect(payload.evidencePackage.gates.every((gate) => gate.manualOnly)).toBe(true);
    expect(payload.evidencePackage.gates[0]?.evidenceRecordTemplate).toHaveProperty("validated", false);
  });
});
