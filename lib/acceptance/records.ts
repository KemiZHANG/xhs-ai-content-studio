import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AcceptanceExternalGate } from "@/lib/acceptance/status";

export type AcceptanceValidationRecord = {
  gateId: AcceptanceExternalGate["id"];
  validated: boolean;
  validatedAt: string;
  operator: string;
  notes: string;
  evidence: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export type AcceptanceValidationDecision = {
  valid: boolean;
  errors: string[];
};

const recordsPath = () => path.join(process.cwd(), "data", "acceptance-validation-records.json");

export async function readAcceptanceValidationRecords(): Promise<AcceptanceValidationRecord[]> {
  try {
    const raw = await readFile(recordsPath(), "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
    return Array.isArray(parsed) ? parsed.map(normalizeRecord).filter(isRecord) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function writeAcceptanceValidationRecords(records: AcceptanceValidationRecord[]): Promise<AcceptanceValidationRecord[]> {
  const filePath = recordsPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const normalized = records.map(normalizeRecord).filter(isRecord);
  await writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

export async function upsertAcceptanceValidationRecord(
  record: AcceptanceValidationRecord
): Promise<AcceptanceValidationRecord[]> {
  const current = await readAcceptanceValidationRecords();
  const next = [
    ...current.filter((item) => item.gateId !== record.gateId),
    normalizeRecord(record)
  ].filter(isRecord);
  return writeAcceptanceValidationRecords(next);
}

export function validateAcceptanceValidationRecord(
  gate: AcceptanceExternalGate,
  record: Partial<AcceptanceValidationRecord>
): AcceptanceValidationDecision {
  const errors: string[] = [];
  if (record.gateId !== gate.id) {
    errors.push(`gateId must be ${gate.id}`);
  }
  if (record.validated !== true) {
    errors.push("validated must be true after manual verification");
  }
  if (!record.validatedAt || Number.isNaN(Date.parse(record.validatedAt))) {
    errors.push("validatedAt must be a valid ISO timestamp");
  }
  if (!record.operator?.trim()) {
    errors.push("operator is required");
  }

  const evidence = record.evidence ?? {};
  for (const field of gate.evidenceFields) {
    const value = evidence[field.key];
    if (field.required && (!value || !String(value).trim())) {
      errors.push(`missing required evidence field: ${field.key}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function summarizeAcceptanceValidationProgress(
  gates: AcceptanceExternalGate[],
  records: AcceptanceValidationRecord[]
) {
  const recordByGate = new Map(records.map((record) => [record.gateId, record]));
  const validatedGateIds = gates
    .filter((gate) => validateAcceptanceValidationRecord(gate, recordByGate.get(gate.id) ?? {}).valid)
    .map((gate) => gate.id);
  const pendingGateIds = gates
    .map((gate) => gate.id)
    .filter((gateId) => !validatedGateIds.includes(gateId));

  return {
    validatedGateIds,
    pendingGateIds,
    allValidated: pendingGateIds.length === 0 && gates.length > 0
  };
}

function normalizeRecord(value: unknown): AcceptanceValidationRecord {
  const now = new Date().toISOString();
  const record = isPlainObject(value) ? value : {};
  const evidence = isPlainObject(record.evidence)
    ? Object.fromEntries(
        Object.entries(record.evidence).map(([key, item]) => [key, typeof item === "string" ? item : String(item ?? "")])
      )
    : {};

  return {
    gateId: typeof record.gateId === "string" ? record.gateId as AcceptanceValidationRecord["gateId"] : "real_publish",
    validated: record.validated === true,
    validatedAt: typeof record.validatedAt === "string" ? record.validatedAt : "",
    operator: typeof record.operator === "string" ? record.operator : "",
    notes: typeof record.notes === "string" ? record.notes : "",
    evidence,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : now
  };
}

function isRecord(value: AcceptanceValidationRecord): value is AcceptanceValidationRecord {
  return Boolean(value.gateId);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
