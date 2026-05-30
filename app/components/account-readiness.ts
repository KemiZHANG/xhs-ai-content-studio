import type { Health, RedactedSettings } from "@/app/types";

export function isHealthForActiveAccount(health: Health | null, settings: RedactedSettings): boolean {
  if (!health?.loggedIn) return false;
  if (health.activeAccount?.id && health.activeAccount.id !== settings.activeAccountId) return false;
  if (health.mcpUrl && normalizeEndpoint(health.mcpUrl) !== normalizeEndpoint(settings.mcpUrl)) return false;
  return true;
}

export function activeAccountReadinessHint(health: Health | null, settings: RedactedSettings): string {
  if (!health) return "请先检测当前小红书 MCP 登录状态";
  if (!health.loggedIn) return "当前小红书 MCP 未登录或登录状态不可确认";
  if (health.activeAccount?.id && health.activeAccount.id !== settings.activeAccountId) {
    return "登录检测结果属于旧账号，请重新检测当前账号";
  }
  if (health.mcpUrl && normalizeEndpoint(health.mcpUrl) !== normalizeEndpoint(settings.mcpUrl)) {
    return "登录检测结果属于旧 MCP 地址，请重新检测当前账号";
  }
  return "当前账号登录状态有效";
}

function normalizeEndpoint(value: string): string {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}
