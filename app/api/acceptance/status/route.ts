import { NextResponse } from "next/server";
import { readAcceptanceValidationRecords } from "@/lib/acceptance/records";
import {
  buildAcceptanceCompletionMatrix,
  buildAcceptanceDeliverySummary,
  buildAcceptanceEvidencePackage,
  buildAcceptanceStatus
} from "@/lib/acceptance/status";

export const runtime = "nodejs";

export async function GET() {
  const validationRecords = await readAcceptanceValidationRecords();
  const status = buildAcceptanceStatus(validationRecords);
  return NextResponse.json({
    ok: true,
    validationRecords,
    status,
    deliverySummary: buildAcceptanceDeliverySummary(status),
    evidencePackage: buildAcceptanceEvidencePackage(status, new Date().toISOString()),
    completionMatrix: buildAcceptanceCompletionMatrix(status, new Date().toISOString())
  });
}
