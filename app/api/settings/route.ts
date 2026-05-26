import { NextResponse } from "next/server";
import { attachActionToken, requireLocalActionToken } from "@/lib/security/action-token";
import { mergeSettingsUpdate, readSettings, redactSettings, writeSettings, type AppSettings } from "@/lib/storage/settings";

export const runtime = "nodejs";

export async function GET() {
  const settings = await readSettings();
  return NextResponse.json(await attachActionToken(redactSettings(settings)));
}

export async function POST(request: Request) {
  const authError = await requireLocalActionToken(request);
  if (authError) return authError;

  const current = await readSettings();
  const { actionToken: _actionToken, ...update } = (await request.json()) as Partial<AppSettings> & {
    actionToken?: string;
  };
  const nextSettings = mergeSettingsUpdate(current, update);
  await writeSettings(nextSettings);

  return NextResponse.json(await attachActionToken(redactSettings(nextSettings)));
}
