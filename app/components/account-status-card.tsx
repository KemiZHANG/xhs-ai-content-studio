"use client";

import { RefreshCw, Settings, UserRound } from "lucide-react";
import { activeAccountReadinessHint, isHealthForActiveAccount } from "@/app/components/account-readiness";
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
  const ready = isHealthForActiveAccount(health, settings);
  const loginName = ready ? health?.activeAccount?.loginName : undefined;
  const state = ready ? "ok" : health?.reachable ? "warn" : health ? "offline" : "unknown";
  const stateLabel = ready
    ? "已登录"
    : !health
      ? "待检测"
      : health.reachable
        ? "需检测当前账号"
        : "MCP 未连接";
  const hint = activeAccountReadinessHint(health, settings);

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
        <span>{loginName ? `登录名：${loginName}` : "登录名：检测当前账号后显示"}</span>
        <span title={activeAccount.mcpUrl}>MCP：{formatMcpEndpoint(activeAccount.mcpUrl)}</span>
        <span>{accounts.length > 1 ? `${accounts.length} 个账号档案` : "1 个账号档案"}</span>
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
      ) : (
        <p className="accountHint">需要多账号时，在账号设置里添加另一个 MCP 地址，例如 18061。</p>
      )}

      <div className="accountActions">
        <button className="sidebarMiniButton" disabled={busy} onClick={onRefresh} type="button">
          <RefreshCw size={14} className={busy ? "spin" : ""} />
          检测当前账号
        </button>
        <button className="sidebarMiniButton" onClick={onManage} type="button">
          <Settings size={14} />
          账号设置
        </button>
      </div>
      <p className="accountHint">{hint}</p>
      {!ready ? <p className="accountHint">未登录时运行 .\login-xhs.ps1 完成登录，再点击检测当前账号。</p> : null}
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
