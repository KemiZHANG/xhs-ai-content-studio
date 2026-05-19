import { NextResponse } from "next/server";
import { listHistory } from "@/lib/storage/history";

export const runtime = "nodejs";

export async function GET() {
  const runs = await listHistory();
  return NextResponse.json({ runs });
}
