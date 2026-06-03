import { NextResponse } from "next/server";
import {
  readAcceptanceValidationRecords,
  upsertAcceptanceValidationRecord,
  validateAcceptanceValidationRecord,
  type AcceptanceValidationRecord
} from "@/lib/acceptance/records";
import { buildAcceptanceCompletionMatrix, buildAcceptanceDeliverySummary, buildAcceptanceStatus } from "@/lib/acceptance/status";

export const runtime = "nodejs";

export async function GET() {
  const records = await readAcceptanceValidationRecords();
  const status = buildAcceptanceStatus(records);
  return NextResponse.json({
    ok: true,
    records,
    status,
    deliverySummary: buildAcceptanceDeliverySummary(status),
    completionMatrix: buildAcceptanceCompletionMatrix(status, new Date().toISOString())
  });
}

export async function POST(request: Request) {
  const payload = await request.json() as Partial<AcceptanceValidationRecord>;
  const status = buildAcceptanceStatus();
  const gate = status.manualGates.find((item) => item.id === payload.gateId);

  if (!gate) {
    return NextResponse.json({ ok: false, error: "Unknown acceptance gate" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const evidence = payload.evidence && typeof payload.evidence === "object"
    ? Object.fromEntries(
        Object.entries(payload.evidence).map(([key, value]) => [key, typeof value === "string" ? value : String(value ?? "")])
      )
    : {};
  const record: AcceptanceValidationRecord = {
    gateId: gate.id,
    validated: payload.validated === true,
    validatedAt: typeof payload.validatedAt === "string" ? payload.validatedAt : now,
    operator: typeof payload.operator === "string" ? payload.operator : "",
    notes: typeof payload.notes === "string" ? payload.notes : "",
    evidence,
    createdAt: typeof payload.createdAt === "string" ? payload.createdAt : now,
    updatedAt: now
  };
  const decision = validateAcceptanceValidationRecord(gate, record);

  if (!decision.valid) {
    return NextResponse.json({ ok: false, error: "Invalid acceptance validation record", errors: decision.errors }, { status: 400 });
  }

  const records = await upsertAcceptanceValidationRecord(record);
  const nextStatus = buildAcceptanceStatus(records);
  return NextResponse.json({
    ok: true,
    record,
    records,
    status: nextStatus,
    deliverySummary: buildAcceptanceDeliverySummary(nextStatus),
    completionMatrix: buildAcceptanceCompletionMatrix(nextStatus, new Date().toISOString())
  });
}
