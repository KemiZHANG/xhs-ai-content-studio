import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/acceptance/validation-records/route";
import {
  readAcceptanceValidationRecords,
  upsertAcceptanceValidationRecord,
  validateAcceptanceValidationRecord
} from "@/lib/acceptance/records";
import { buildAcceptanceCompletionMatrix, buildAcceptanceDeliverySummary, buildAcceptanceStatus } from "@/lib/acceptance/status";

const originalCwd = process.cwd();
let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-acceptance-records-"));
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("acceptance validation records", () => {
  it("starts with no external validation records and keeps completion at 99", async () => {
    const records = await readAcceptanceValidationRecords();
    const status = buildAcceptanceStatus(records);

    expect(records).toEqual([]);
    expect(status.completionPercent).toBe(99);
    expect(status.canMarkComplete).toBe(false);
    expect(status.validatedManualGateIds).toEqual([]);
    expect(status.pendingManualGateIds).toEqual([
      "real_publish",
      "scheduled_publish",
      "multi_account_switching",
      "large_scale_image_generation"
    ]);
  });

  it("validates required evidence fields before accepting a manual gate", () => {
    const gate = buildAcceptanceStatus().manualGates.find((item) => item.id === "real_publish");
    expect(gate).toBeTruthy();

    const decision = validateAcceptanceValidationRecord(gate!, {
      gateId: "real_publish",
      validated: true,
      validatedAt: "2026-06-03T12:00:00.000Z",
      operator: "Kemi",
      evidence: {
        accountName: "test account",
        mcpUrl: "http://localhost:18060/mcp"
      }
    });

    expect(decision.valid).toBe(false);
    expect(decision.errors).toContain("missing required evidence field: publishReceipt");
    expect(decision.errors).toContain("missing required evidence field: xhsProof");
  });

  it("moves to 100 only after every external gate has a valid manual record", async () => {
    const status = buildAcceptanceStatus();
    const records = status.manualGates.map((gate, index) => ({
      gateId: gate.id,
      validated: true,
      validatedAt: `2026-06-03T12:0${index}:00.000Z`,
      operator: "Kemi",
      notes: "manual validation completed",
      evidence: Object.fromEntries(gate.evidenceFields.map((field) => [field.key, field.example])),
      createdAt: `2026-06-03T12:0${index}:00.000Z`,
      updatedAt: `2026-06-03T12:0${index}:00.000Z`
    }));

    for (const record of records) {
      await upsertAcceptanceValidationRecord(record);
    }

    const stored = await readAcceptanceValidationRecords();
    const completedStatus = buildAcceptanceStatus(stored);
    const delivery = buildAcceptanceDeliverySummary(completedStatus);

    expect(stored).toHaveLength(status.manualGates.length);
    expect(completedStatus.completionPercent).toBe(100);
    expect(completedStatus.canMarkComplete).toBe(true);
    expect(completedStatus.pendingManualGateIds).toEqual([]);
    expect(delivery.safeToAutomateCompletion).toBe(true);
    expect(delivery.manualGateLine).toBe("没有剩余人工闸门");
  });

  it("rejects invalid API records and accepts valid manual evidence through the route", async () => {
    const invalidResponse = await POST(new Request("http://localhost/api/acceptance/validation-records", {
      method: "POST",
      body: JSON.stringify({
        gateId: "real_publish",
        validated: true,
        validatedAt: "2026-06-03T12:00:00.000Z",
        operator: "Kemi",
        evidence: {
          accountName: "test account"
        }
      })
    }));
    const invalidPayload = await invalidResponse.json() as { ok: boolean; errors: string[] };

    expect(invalidResponse.status).toBe(400);
    expect(invalidPayload.ok).toBe(false);
    expect(invalidPayload.errors).toContain("missing required evidence field: publishReceipt");
    await expect(readAcceptanceValidationRecords()).resolves.toEqual([]);

    const gate = buildAcceptanceStatus().manualGates.find((item) => item.id === "real_publish");
    expect(gate).toBeTruthy();
    const validResponse = await POST(new Request("http://localhost/api/acceptance/validation-records", {
      method: "POST",
      body: JSON.stringify({
        gateId: "real_publish",
        validated: true,
        validatedAt: "2026-06-03T12:00:00.000Z",
        operator: "Kemi",
        notes: "private publish manually verified",
        evidence: Object.fromEntries(gate!.evidenceFields.map((field) => [field.key, field.example]))
      })
    }));
    const validPayload = await validResponse.json() as {
      ok: boolean;
      records: Array<{ gateId: string }>;
      status: ReturnType<typeof buildAcceptanceStatus>;
      completionMatrix: ReturnType<typeof buildAcceptanceCompletionMatrix>;
    };

    expect(validResponse.status).toBe(200);
    expect(validPayload.ok).toBe(true);
    expect(validPayload.records).toEqual([expect.objectContaining({ gateId: "real_publish" })]);
    expect(validPayload.status.validatedManualGateIds).toContain("real_publish");
    expect(validPayload.status.pendingManualGateIds).not.toContain("real_publish");
    expect(validPayload.status.canMarkComplete).toBe(false);
    expect(validPayload.completionMatrix.completionPercent).toBe(99);
    expect(validPayload.completionMatrix.manualExternalGates.find((item) => item.id === "real_publish")?.status).toBe("validated");
    expect(validPayload.completionMatrix.remainingWork.map((item) => item.id)).not.toContain("real_publish");

    const getResponse = await GET();
    const getPayload = await getResponse.json() as {
      ok: boolean;
      records: Array<{ gateId: string }>;
      status: ReturnType<typeof buildAcceptanceStatus>;
      completionMatrix: ReturnType<typeof buildAcceptanceCompletionMatrix>;
    };
    expect(getPayload.ok).toBe(true);
    expect(getPayload.records).toHaveLength(1);
    expect(getPayload.status.validatedManualGateIds).toContain("real_publish");
    expect(getPayload.completionMatrix.manualExternalGates.find((item) => item.id === "real_publish")?.status).toBe("validated");
  });
});
