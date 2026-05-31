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

        {legacyRibbonSections.has(section) ? ribbon : null}
        {children}
      </section>
    </main>
  );
}
