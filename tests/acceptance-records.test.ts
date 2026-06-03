import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  readAcceptanceValidationRecords,
  upsertAcceptanceValidationRecord,
  validateAcceptanceValidationRecord
} from "@/lib/acceptance/records";
import { buildAcceptanceDeliverySummary, buildAcceptanceStatus } from "@/lib/acceptance/status";

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
});
