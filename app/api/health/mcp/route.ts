import { NextResponse } from "next/server";
import { createXhsMcpClient, readMcpText } from "@/lib/mcp/xhs";
import { readSettings } from "@/lib/storage/settings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await readSettings();
    const client = createXhsMcpClient(settings);
    const result = await client.checkLoginStatus();
    const text = readMcpText(result);

    return NextResponse.json({
      ok: true,
      reachable: true,
      loggedIn: /已登录|logged/i.test(text),
      message: text,
      mcpUrl: settings.mcpUrl
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        reachable: false,
        loggedIn: false,
        message: error instanceof Error ? error.message : "MCP 检测失败"
      },
      { status: 200 }
    );
  }
}
