"use client";

import type { ReactNode } from "react";
import {
  Layers3,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AssetRecord, DraftRecord, Health, JobRecord, RedactedSettings, Section } from "@/app/types";
import { AccountStatusCard } from "@/app/components/account-status-card";
import { StatusPill } from "@/app/components/status-badges";
import { subtitleForSection, titleForSection } from "@/app/components/xhs-display-utils";

const navItems: Array<{ id: Section; label: string; icon: LucideIcon }> = [
  { id: "flow", label: "Post Studio", icon: Layers3 },
  { id: "assets", label: "Assets", icon: Sparkles },
  { id: "audit", label: "Publish History", icon: ShieldCheck },
  { id: "settings", label: "Settings", icon: Settings }
];

export const legacyRibbonSections = new Set<Section>(["workflow", "jobs", "imageStudio", "chat", "publish", "history"]);

const legacySectionHints: Partial<Record<Section, { label: string; detail: string }>> = {
  workflow: {
    label: "高级研究入口",
    detail: "日常搜索、证据提炼和后续创作都建议在 Post Studio 内完成。"
  },
  jobs: {
    label: "任务排查入口",
    detail: "这里只用于查看后台任务细节；当前创作进度会同步回 Post Studio。"
  },
  imageStudio: {
    label: "高级图片工具",
    detail: "批量生图和图文卡片可在这里处理，最终选图仍回到 Post Studio 组合。"
  },
  chat: {
    label: "旧版 AI 工作台",
    detail: "新的创作导演 Agent 已集中到 Post Studio，那里会记住当前帖子项目。"
  },
  publish: {
    label: "备用发布装配",
    detail: "正式发布建议回到 Post Studio 的发布检查页，先锁定版本和确认单。"
  },
  history: {
    label: "旧版历史记录",
    detail: "用于回看旧运行；继续创作请恢复到当前 Post Studio。"
  }
};

export function AppShell({
  section,
  settings,
  health,
  settingsBusy,
  modelReady,
  imageReady,
  jobs,
  assets,
  currentDraft,
  notice,
  ribbon,
  children,
  onNavigate,
  onRefreshHealth,
  onSwitchAccount
}: {
  section: Section;
  settings: RedactedSettings;
  health: Health | null;
  settingsBusy: string | null;
  modelReady: boolean;
  imageReady: boolean;
  jobs: JobRecord[];
  assets: AssetRecord[];
  currentDraft: DraftRecord | null;
  notice: string;
  ribbon?: ReactNode;
  children: ReactNode;
  onNavigate: (section: Section) => void;
  onRefreshHealth: () => void;
  onSwitchAccount: (accountId: string) => void;
}) {
  const runningCount = jobs.filter((job) => job.status === "queued" || job.status === "running").length;

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="brandBlock">
          <div className="brandMark">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="brandTitle">XHS AI Studio</div>
            <div className="brandSubtitle">本地内容中台</div>
          </div>
        </div>

        <nav className="navList" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={section === item.id ? "navItem active" : "navItem"}
                onClick={() => onNavigate(item.id)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebarMainPath" role="note">
          <span>日常主流程</span>
          <strong>创作始终回到 Post Studio</strong>
          <p>Assets、Publish History、Settings 只做素材、记录和配置；研究、文案、图片、发布检查都在一个帖子项目里完成。</p>
          <button type="button" onClick={() => onNavigate("flow")}>打开主工作台</button>
        </div>

        <AccountStatusCard
          settings={settings}
          health={health}
          busy={settingsBusy === "health" || settingsBusy === "account-switch"}
          onRefresh={onRefreshHealth}
          onManage={() => onNavigate("settings")}
          onSwitch={onSwitchAccount}
        />

        <div className="sidebarStatus">
          <StatusPill ok={modelReady} label={modelReady ? "文本模型已配置" : "缺少文本模型"} />
          <StatusPill ok={imageReady} label={imageReady ? "图片模型已配置" : "缺少图片模型"} />
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="titleBlock">
            <p className="eyebrow">Agent Content Operations</p>
            <h1>{titleForSection(section)}</h1>
            <p className="pageSubtitle">{subtitleForSection(section)}</p>
          </div>
          <div className="topbarActions">
            <div className="topbarStats" aria-label="当前工作区状态">
              <span>
                <strong>{runningCount}</strong>
                运行中
              </span>
              <span>
                <strong>{assets.length}</strong>
                素材
              </span>
              <span>
                <strong>{currentDraft ? 1 : 0}</strong>
                当前草稿
              </span>
            </div>
            {notice ? <span className="notice">{notice}</span> : null}
            <button className="iconButton" onClick={onRefreshHealth} type="button" title="刷新 MCP 状态" aria-label="刷新 MCP 状态">
              <RefreshCw size={18} className={settingsBusy === "health" ? "spin" : ""} />
            </button>
          </div>
        </header>

        {legacyRibbonSections.has(section) ? (
          <LegacyReturnBanner section={section} onNavigate={onNavigate} />
        ) : null}
        {legacyRibbonSections.has(section) ? ribbon : null}
        {children}
      </section>
    </main>
  );
}

function LegacyReturnBanner({
  section,
  onNavigate
}: {
  section: Section;
  onNavigate: (section: Section) => void;
}) {
  const hint = legacySectionHints[section];
  if (!hint) return null;

  return (
    <div className="legacyReturnBanner" role="note">
      <div>
        <span>{hint.label}</span>
        <strong>主流程请回到 Post Studio</strong>
        <p>{hint.detail}</p>
      </div>
      <button className="primaryButton" type="button" onClick={() => onNavigate("flow")}>
        回到 Post Studio
      </button>
    </div>
  );
}
