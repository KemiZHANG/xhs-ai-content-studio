import { NextResponse } from "next/server";
import { readCreatorMemoryProfile, writeCreatorMemoryProfile } from "@/lib/agent/memory";
import { requireLocalActionToken } from "@/lib/security/action-token";
import { readSettings } from "@/lib/storage/settings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await readSettings();
    const profile = await readCreatorMemoryProfile(settings.activeAccountId);
    return NextResponse.json({ memory: profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取创作者记忆失败" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const authError = await requireLocalActionToken(request);
    if (authError) return authError;

    const settings = await readSettings();
    const body = (await request.json()) as Record<string, unknown>;
    const current = await readCreatorMemoryProfile(settings.activeAccountId);
    const profile = await writeCreatorMemoryProfile({
      ...current,
      ...body,
      accountId: settings.activeAccountId,
      updatedAt: new Date().toISOString()
    });
    return NextResponse.json({ memory: profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新创作者记忆失败" },
      { status: 500 }
    );
  }
}
