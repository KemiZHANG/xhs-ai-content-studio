import { NextResponse } from "next/server";
import { createAgentToolRegistry } from "@/lib/agent/tools/registry";
import { createXhsMcpClient, readMcpText } from "@/lib/mcp/xhs";
import { readSettings } from "@/lib/storage/settings";

export const runtime = "nodejs";

export async function GET() {
  const settings = await readSettings();
  const activeAccount =
    settings.accounts.find((account) => account.id === settings.activeAccountId) ?? settings.accounts[0];

  try {
    const client = createXhsMcpClient(settings);
    const result = await client.checkLoginStatus();
    const text = readMcpText(result);
    const loggedIn = /已登录|logged/i.test(text);
    const loginName = extractLoginName(text);
    const tools = await client.listTools().catch(() => []);
    const toolNames = tools.map((tool) => tool.name).filter(Boolean);
    const registry = createAgentToolRegistry();
    const agentTools = registry.list().map((tool) => {
      const requiredTools = tool.mcpTools ?? [];
      const missingMcpTools = requiredTools.filter((name) => !toolNames.includes(name));
      return {
        name: tool.name,
        profile: tool.profile,
        risk: tool.risk,
        requiresConfirmation: tool.requiresConfirmation,
        requiresMcp: tool.requiresMcp,
        mcpTools: requiredTools,
        missingMcpTools,
        runnable: !tool.requiresMcp || missingMcpTools.length === 0
      };
    });

    return NextResponse.json({
      ok: true,
      reachable: true,
      loggedIn,
      message: text,
      mcpUrl: settings.mcpUrl,
      activeAccount: activeAccount
        ? {
            ...activeAccount,
            status: loggedIn ? "logged_in" : "logged_out",
            loginName
          }
        : undefined,
      tools: toolNames,
      agentTools
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        reachable: false,
        loggedIn: false,
        message: error instanceof Error ? error.message : "MCP 检测失败",
        mcpUrl: settings.mcpUrl,
        activeAccount: activeAccount
          ? {
              ...activeAccount,
              status: "logged_out"
            }
          : undefined
      },
      { status: 200 }
    );
  }
}

function extractLoginName(text: string): string | undefined {
  const patterns = [
    /用户名[:：]\s*([^\s，。,]+)/i,
    /账号[:：]\s*([^\s，。,]+)/i,
    /nickname["'\s:：]+([^"',，。,\s]+)/i,
    /user(name)?["'\s:：]+([^"',，。,\s]+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[2] ?? match?.[1];
    if (value?.trim()) {
      return value.trim();
    }
  }

  return undefined;
}
