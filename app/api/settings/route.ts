import { NextResponse } from "next/server";
import { mergeSettingsUpdate, readSettings, redactSettings, writeSettings, type AppSettings } from "@/lib/storage/settings";

export const runtime = "nodejs";

export async function GET() {
  const settings = await readSettings();
  return NextResponse.json(redactSettings(settings));
}

export async function POST(request: Request) {
  const current = await readSettings();
  const update = (await request.json()) as Partial<AppSettings>;
  const nextSettings = mergeSettingsUpdate(current, update);
  await writeSettings(nextSettings);

  return NextResponse.json(redactSettings(nextSettings));
}
