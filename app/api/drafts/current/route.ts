import { NextResponse } from "next/server";
import { readCurrentDraft } from "@/lib/storage/drafts";

export const runtime = "nodejs";

export async function GET() {
  try {
    const currentDraft = await readCurrentDraft();
    return NextResponse.json({ currentDraft });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取当前草稿失败" },
      { status: 500 }
    );
  }
}
