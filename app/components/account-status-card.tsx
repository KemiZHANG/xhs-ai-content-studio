"use client";

import { RefreshCw, Settings, UserRound } from "lucide-react";
import type { Health, RedactedSettings } from "@/app/types";

const fallbackAccount = {
  id: "local-default",
  displayName: "默认小红书账号",
  mcpUrl: "http://localhost:18060/mcp",
  status: "unknown" as const,
  createdAt: "2026-05-25T00:00:00.000Z",
  updatedAt: "2026-05-25T00:00:00.000Z"
};

export function AccountStatusCard({
  settings,
  health,
  busy,
  onRefresh,
  onManage,
  onSwitch
}: {
  settings: RedactedSettings;
  health: Health | null;
  busy: boolean;
  onRefresh: () => void;
  onManage: () => void;
  onSwitch: (accountId: string) => void;
}) {
  const accounts = settings.accounts?.length ? settings.accounts : [fallbackAccount];
  const activeAccount = accounts.find((account) => account.id === settings.activeAccountId) ?? accounts[0];
  const loginName = health?.activeAccount?.loginName;
  const state = !health ? "unknown" : health.loggedIn ? "ok" : health.reachable ? "warn" : "offline";
  const stateLabel = !health
    ? "待检测"
    : health.loggedIn
      ? "已登录"
      : health.reachable
        ? "未登录"
        : "MCP 未连接";

  return (
    <section className="accountStatusCard" aria-label="小红书账号状态">
      <div className="accountStatusHeader">
        <div className="accountAvatar" aria-hidden="true">
          <UserRound size={18} />
        </div>
        <div className="accountIdentity">
          <span className="accountMeta">当前小红书账号</span>
          <strong className="accountName">{activeAccount.displayName}</strong>
        </div>
        <span className={`accountState ${state}`}>
          <i />
          {stateLabel}
        </span>
      </div>

      <div className="accountDetails">
        <span>{loginName ? `登录名：${loginName}` : "登录名：检测后显示"}</span>
        <span title={activeAccount.mcpUrl}>{formatMcpEndpoint(activeAccount.mcpUrl)}</span>
      </div>

      {accounts.length > 1 ? (
        <label className="accountSwitcher">
          <span>切换账号</span>
          <select disabled={busy} value={activeAccount.id} onChange={(event) => onSwitch(event.target.value)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="accountActions">
        <button className="sidebarMiniButton" disabled={busy} onClick={onRefresh} type="button">
          <RefreshCw size={14} className={busy ? "spin" : ""} />
          检测
        </button>
        <button className="sidebarMiniButton" onClick={onManage} type="button">
          <Settings size={14} />
          管理
        </button>
      </div>
      {!health?.loggedIn ? <p className="accountHint">未登录时运行 .\login-xhs.ps1 完成登录，再点击检测。</p> : null}
    </section>
  );
}

function formatMcpEndpoint(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || (parsed.protocol === "https:" ? "443" : "80")}`;
  } catch {
    return url || "未配置 MCP";
  }
}
