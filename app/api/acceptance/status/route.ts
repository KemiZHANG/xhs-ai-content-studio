import { NextResponse } from "next/server";
import { buildAcceptanceStatus } from "@/lib/acceptance/status";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: buildAcceptanceStatus()
  });
}

