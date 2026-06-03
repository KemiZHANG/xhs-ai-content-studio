import { NextResponse } from "next/server";
import { buildAcceptanceDeliverySummary, buildAcceptanceStatus } from "@/lib/acceptance/status";

export const runtime = "nodejs";

export async function GET() {
  const status = buildAcceptanceStatus();
  return NextResponse.json({
    ok: true,
    status,
    deliverySummary: buildAcceptanceDeliverySummary(status)
  });
}
