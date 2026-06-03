"use client";

import { Save } from "lucide-react";
import type { FormEvent } from "react";
import {
  applyImageProviderPreset,
  applyTextProviderPreset,
  inferImageProviderPreset,
  inferTextProviderPreset,
  modelProviderPresets,
  type ModelProviderPreset
} from "@/lib/models/presets";
import { AcceptanceStatusPanel } from "@/app/components/acceptance-status-panel";
import type { RedactedSettings, SettingsDraft, XhsAccountProfile } from "@/app/types";

const fallbackAccounts: XhsAccountProfile[] = [
  {
    id: "local-default",
    displayName: "默认小红书账号",
    mcpUrl: "http://localhost:18060/mcp",
    status: "unknown",
    createdAt: "2026-05-25T00:00:00.000Z",
    updatedAt: "2026-05-25T00:00:00.000Z"
  }
];

export function SettingsPanel({
  settings,
  draft,
  busy,
  onChange,
  onSubmit
}: {
  settings: RedactedSettings;
  draft: SettingsDraft;
  busy: boolean;
  onChange: (next: SettingsDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const textProvider = inferTextProviderPreset(draft);
  const imageProvider = inferImageProviderPreset(draft);
  const accounts = draft.accounts?.length ? draft.accounts : fallbackAccounts;
  const activeAccount = accounts.find((account) => account.id === draft.activeAccountId) ?? accounts[0];

  function selectAccount(accountId: string) {
    const nextAccount = accounts.find((account) => account.id === accountId) ?? accounts[0];
    onChange({
      ...draft,
      activeAccountId: nextAccount.id,
      mcpUrl: nextAccount.mcpUrl
    });
  }

  function updateActiveAccountUrl(mcpUrl: string) {
    onChange({
      ...draft,
      mcpUrl,
      accounts: accounts.map((account) =>
        account.id === activeAccount.id ? { ...account, mcpUrl, updatedAt: new Date().toISOString() } : account
      )
    });
  }

  function updateActiveAccountName(displayName: string) {
    onChange({
      ...draft,
      accounts: accounts.map((account) =>
        account.id === activeAccount.id ? { ...account, displayName, updatedAt: new Date().toISOString() } : account
      )
    });
  }

  function addAccount() {
    const nextId = `xhs-account-${Date.now()}`;
    const nextAccount: XhsAccountProfile = {
      id: nextId,
      displayName: `小红书账号 ${accounts.length + 1}`,
      mcpUrl: draft.mcpUrl || "http://localhost:18060/mcp",
      status: "unknown",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    onChange({
      ...draft,
      accounts: [...accounts, nextAccount],
      activeAccountId: nextId,
      mcpUrl: nextAccount.mcpUrl
    });
  }

  return (
    <section className="panel settingsPanel">
      <div className="panelHeader">
        <div>
          <h2>连接配置</h2>
          <p>普通用户只需要选择服务商并填写 API Key。Base URL 和模型名称会自动设置，并且只保存在本机。</p>
        </div>
      </div>

      <form className="formStack" onSubmit={onSubmit}>
        <section className="settingsGroup accountSettings">
          <div>
            <h3>小红书账号管理</h3>
            <p>每个账号档案对应一个 MCP 地址。保存后，左侧账号卡会显示当前激活账号、登录状态和切换入口。</p>
          </div>
          <div className="formRow">
            <label>
              <span>编辑账号档案</span>
              <select value={activeAccount.id} onChange={(event) => selectAccount(event.target.value)}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.displayName}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondaryButton accountAddButton" type="button" onClick={addAccount}>
              新增账号档案
            </button>
          </div>
          <label>
            <span>账号显示名</span>
            <input value={activeAccount.displayName} onChange={(event) => updateActiveAccountName(event.target.value)} />
            <small className="fieldHint">这是本地显示名，方便你区分多个账号；真实小红书昵称会在登录检测后显示在左侧账号卡。</small>
          </label>
        </section>

        <label>
          <span>MCP 地址</span>
          <input value={draft.mcpUrl} onChange={(event) => updateActiveAccountUrl(event.target.value)} />
        </label>

        <section className="settingsGroup">
          <div>
            <h3>文本模型</h3>
            <p>用于 AI 对话、研究总结、文案生成和图片理解。大多数人选 Gemini 后只填 API Key 就可以。</p>
          </div>
          <label>
            <span>文本模型服务商</span>
            <select
              value={textProvider}
              onChange={(event) =>
                onChange(applyTextProviderPreset(draft, event.target.value as ModelProviderPreset))
              }
            >
              <option value="gemini">Gemini（推荐，只填 API Key）</option>
              <option value="openai">OpenAI（只填 API Key）</option>
              <option value="custom">自定义 OpenAI-compatible 接口</option>
            </select>
            <small className="fieldHint">{providerDescription(textProvider)}</small>
          </label>

          <label>
            <span>文本 API Key：{settings.textApiKey === "configured" ? "已配置" : "未配置"}</span>
            <input
              autoComplete="off"
              placeholder="填入你自己的 API Key；留空表示不修改已保存的 Key"
              type="password"
              value={draft.textApiKey}
              onChange={(event) => onChange({ ...draft, textApiKey: event.target.value })}
            />
          </label>

          <details className="advancedSettings" open={textProvider === "custom"}>
            <summary>高级设置：文本 Base URL 和模型名称</summary>
            <div className="formRow">
              <label>
                <span>文本 Base URL</span>
                <input value={draft.textBaseUrl} onChange={(event) => onChange({ ...draft, textBaseUrl: event.target.value })} />
              </label>
              <label>
                <span>文本模型</span>
                <input value={draft.textModel} onChange={(event) => onChange({ ...draft, textModel: event.target.value })} />
              </label>
            </div>
          </details>
        </section>

        <section className="settingsGroup">
          <div>
            <h3>图片模型</h3>
            <p>用于生成原创配图和产品场景图。基于产品图生成新图时，Gemini 路径支持更完整的参考图输入。</p>
          </div>
          <label>
            <span>图片模型服务商</span>
            <select
              value={imageProvider}
              onChange={(event) =>
                onChange(applyImageProviderPreset(draft, event.target.value as ModelProviderPreset))
              }
            >
              <option value="gemini">Gemini / Nano Banana（推荐，只填 API Key）</option>
              <option value="openai">OpenAI（只填 API Key）</option>
              <option value="custom">自定义 OpenAI-compatible 接口</option>
            </select>
            <small className="fieldHint">{providerDescription(imageProvider)}</small>
          </label>

          <label>
            <span>图片 API Key：{settings.imageApiKey === "configured" ? "已配置" : "未配置"}</span>
            <input
              autoComplete="off"
              placeholder="填入你自己的 API Key；留空表示不修改已保存的 Key"
              type="password"
              value={draft.imageApiKey}
              onChange={(event) => onChange({ ...draft, imageApiKey: event.target.value })}
            />
          </label>

          <details className="advancedSettings" open={imageProvider === "custom"}>
            <summary>高级设置：图片 Base URL 和模型名称</summary>
            <div className="formRow">
              <label>
                <span>图片 Base URL</span>
                <input value={draft.imageBaseUrl} onChange={(event) => onChange({ ...draft, imageBaseUrl: event.target.value })} />
              </label>
              <label>
                <span>图片模型</span>
                <input value={draft.imageModel} onChange={(event) => onChange({ ...draft, imageModel: event.target.value })} />
              </label>
            </div>
          </details>
        </section>

        <div className="formRow">
          <label>
            <span>默认可见范围</span>
            <select
              value={draft.defaultVisibility}
              onChange={(event) =>
                onChange({
                  ...draft,
                  defaultVisibility: event.target.value as RedactedSettings["defaultVisibility"]
                })
              }
            >
              <option>仅自己可见</option>
              <option>公开可见</option>
              <option>仅互关好友可见</option>
            </select>
          </label>
          <label className="checkLine settingsCheck">
            <input
              checked={draft.defaultAutoPublish}
              type="checkbox"
              onChange={(event) => onChange({ ...draft, defaultAutoPublish: event.target.checked })}
            />
            <span>默认自动发布</span>
          </label>
        </div>

        <section className="settingsGroup">
          <div>
            <h3>Agent 发布权限</h3>
            <p>控制网页 AI 对话能不能真实触发外部发布。建议日常使用“半自动”，先生成发布确认单。</p>
          </div>
          <label>
            <span>对话发布模式</span>
            <select
              value={draft.agentPublishPolicy}
              onChange={(event) =>
                onChange({
                  ...draft,
                  agentPublishPolicy: event.target.value as RedactedSettings["agentPublishPolicy"]
                })
              }
            >
              <option value="draft_only">安全模式：只生成内容，不发布</option>
              <option value="review_required">半自动模式：发布前确认</option>
              <option value="auto_publish_allowed">自动模式：允许对话准备发布确认单</option>
            </select>
            <small className="fieldHint">
              真实发布仍会经过标题、正文、标签、图片、可见范围、定时时间、重复发布检查和一次性确认。
            </small>
          </label>
        </section>

        <section className="settingsGroup">
          <div>
            <h3>模型成本与风险控制</h3>
            <p>给文本分析、图片生成和竞品研究设置本地上限，避免一次误操作消耗太多模型额度。</p>
          </div>
          <div className="formRow">
            <label>
              <span>每日文本模型调用上限</span>
              <input
                min={1}
                max={500}
                type="number"
                value={draft.dailyTextCallLimit}
                onChange={(event) => onChange({ ...draft, dailyTextCallLimit: Number(event.target.value) })}
              />
            </label>
            <label>
              <span>每日图片模型调用上限</span>
              <input
                min={1}
                max={100}
                type="number"
                value={draft.dailyImageCallLimit}
                onChange={(event) => onChange({ ...draft, dailyImageCallLimit: Number(event.target.value) })}
              />
            </label>
          </div>
          <label>
            <span>单次研究样本上限</span>
            <input
              min={3}
              max={30}
              type="number"
              value={draft.maxResearchSamples}
              onChange={(event) => onChange({ ...draft, maxResearchSamples: Number(event.target.value) })}
            />
            <small className="fieldHint">AI 工作台和主题研究台都会遵守这个上限。</small>
          </label>
        </section>

        <AcceptanceStatusPanel />

        <button className="primaryButton" disabled={busy} type="submit">
          <Save size={16} />
          {busy ? "保存中" : "保存设置"}
        </button>
      </form>
    </section>
  );
}

export function providerDescription(provider: ModelProviderPreset): string {
  if (provider === "custom") {
    return "用于硅基流动、OpenRouter、自建网关等兼容 OpenAI 格式的服务，需要自己填写 Base URL 和模型名称。";
  }
  return modelProviderPresets[provider].description;
}
