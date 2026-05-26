"use client";

import { FormEvent, useState } from "react";
import { clientApi, setClientActionToken } from "@/app/client/api";
import type { Health, RedactedSettings, SettingsDraft, XhsAccountProfile } from "@/app/types";

type SettingsBusy = "settings" | "health" | "account-switch" | null;

type UseSettingsHealthOptions = {
  onNotice?: (message: string) => void;
  onBeforeAccountSwitch?: (account: XhsAccountProfile) => void;
  onAfterAccountSwitch?: () => void | Promise<void>;
};

export function toSettingsDraft(settings: RedactedSettings): SettingsDraft {
  const { actionToken: _actionToken, textApiKey: _textApiKey, imageApiKey: _imageApiKey, ...draft } = settings;
  return {
    ...draft,
    textApiKey: "",
    imageApiKey: ""
  };
}

export function useSettingsHealth(
  defaultSettings: RedactedSettings,
  options: UseSettingsHealthOptions = {}
) {
  const [settings, setSettings] = useState<RedactedSettings>(defaultSettings);
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(toSettingsDraft(defaultSettings));
  const [health, setHealth] = useState<Health | null>(null);
  const [settingsBusy, setSettingsBusy] = useState<SettingsBusy>(null);

  const modelReady = settings.textApiKey === "configured";
  const imageReady = settings.imageApiKey === "configured";

  async function loadSettings() {
    const data = await clientApi<RedactedSettings>("/api/settings");
    setClientActionToken(data.actionToken);
    setSettings(data);
    setSettingsDraft(toSettingsDraft(data));
    return data;
  }

  async function checkHealth() {
    setSettingsBusy("health");
    try {
      const data = await clientApi<Health>("/api/health/mcp");
      setHealth(data);
      if (data.activeAccount) {
        setSettings((current) => ({
          ...current,
          mcpUrl: data.mcpUrl ?? current.mcpUrl,
          accounts: current.accounts.map((account) =>
            account.id === data.activeAccount?.id
              ? {
                  ...account,
                  status: data.loggedIn ? "logged_in" : "logged_out",
                  updatedAt: new Date().toISOString()
                }
              : account
          )
        }));
      }
      return data;
    } finally {
      setSettingsBusy(null);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsBusy("settings");
    options.onNotice?.("");
    try {
      const data = await clientApi<RedactedSettings>("/api/settings", {
        method: "POST",
        body: JSON.stringify(settingsDraft)
      });
      setClientActionToken(data.actionToken);
      setSettings(data);
      setSettingsDraft(toSettingsDraft(data));
      options.onNotice?.("设置已保存");
      return data;
    } finally {
      setSettingsBusy(null);
    }
  }

  async function switchActiveAccount(accountId: string) {
    const nextAccount = settings.accounts.find((account) => account.id === accountId);
    if (!nextAccount || nextAccount.id === settings.activeAccountId) {
      return;
    }

    setSettingsBusy("account-switch");
    options.onNotice?.("");
    options.onBeforeAccountSwitch?.(nextAccount);
    try {
      const data = await clientApi<RedactedSettings>("/api/settings", {
        method: "POST",
        body: JSON.stringify({
          ...settings,
          activeAccountId: nextAccount.id,
          mcpUrl: nextAccount.mcpUrl,
          accounts: settings.accounts
        })
      });
      setClientActionToken(data.actionToken);
      setSettings(data);
      setSettingsDraft(toSettingsDraft(data));
      setHealth(null);
      options.onNotice?.(`已切换到 ${nextAccount.displayName}，正在重新检测登录状态。`);
      await checkHealth();
      await options.onAfterAccountSwitch?.();
      return data;
    } finally {
      setSettingsBusy(null);
    }
  }

  return {
    settings,
    setSettings,
    settingsDraft,
    setSettingsDraft,
    health,
    settingsBusy,
    modelReady,
    imageReady,
    loadSettings,
    checkHealth,
    saveSettings,
    switchActiveAccount
  };
}
