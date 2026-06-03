import { NextResponse } from "next/server";
import { buildAcceptanceDeliverySummary, buildAcceptanceEvidencePackage, buildAcceptanceStatus } from "@/lib/acceptance/status";

export const runtime = "nodejs";

export async function GET() {
  const status = buildAcceptanceStatus();
  return NextResponse.json({
    ok: true,
    status,
    deliverySummary: buildAcceptanceDeliverySummary(status),
    evidencePackage: buildAcceptanceEvidencePackage(status, new Date().toISOString())
  });
}
