import { NextResponse } from "next/server";
import { readAcceptanceValidationRecords } from "@/lib/acceptance/records";
import { buildAcceptanceCompletionMatrix, buildAcceptanceStatus } from "@/lib/acceptance/status";

export const runtime = "nodejs";

export async function GET() {
  const status = buildAcceptanceStatus(await readAcceptanceValidationRecords());
  return NextResponse.json({
    ok: true,
    completionMatrix: buildAcceptanceCompletionMatrix(status, new Date().toISOString())
  });
}
