import { NextResponse } from "next/server";
import { listPublishAudit } from "@/lib/storage/publish-audit";

export const runtime = "nodejs";

export async function GET() {
  const audit = await listPublishAudit();
  return NextResponse.json({ audit });
}
