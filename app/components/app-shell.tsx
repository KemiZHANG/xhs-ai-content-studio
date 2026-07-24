"use client";

import type { ReactNode } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileText,
  Image,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Search,
  Send,
  Settings,
  X
} from "lucide-react";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { AssetRecord, DraftRecord, Health, JobRecord, RedactedSettings, Section } from "@/app/types";

type NavigationItem = {
  id: Section;
  label: string;
  icon: LucideIcon;
};

const primaryNavigation: NavigationItem[] = [
  { id: "workspace", label: "工作台", icon: LayoutDashboard },
  { id: "research", label: "研究", icon: Search },
  { id: "compose", label: "文案", icon: FileText },
  { id: "visuals", label: "图片", icon: Image },
  { id: "studioPublish", label: "发布", icon: Send },
  { id: "library", label: "资料库", icon: BookOpen }
];

const utilityNavigation: NavigationItem[] = [
  { id: "jobs", label: "任务", icon: Clock3 },
  { id: "audit", label: "发布记录", icon: CheckCircle2 },
  { id: "settings", label: "设置", icon: Settings }
];

const sectionCopy: Partial<Record<Section, { title: string; subtitle: string }>> = {
  workspace: { title: "工作台", subtitle: "从这里开始，并随时看清下一步。" },
  research: { title: "研究", subtitle: "先确定主题、受众和可用证据。" },
  compose: { title: "文案", subtitle: "集中完成标题、正文和标签。" },
  visuals: { title: "图片", subtitle: "准备参考图、生成图并确认最终画面。" },
  studioPublish: { title: "发布", subtitle: "核对内容、账号与发布设置。" },
  library: { title: "资料库", subtitle: "管理可以重复使用的图片和内容资料。" },
  jobs: { title: "任务", subtitle: "查看后台任务的进度和结果。" },
  audit: { title: "发布记录", subtitle: "回看每次发布请求和执行结果。" },
  settings: { title: "设置", subtitle: "管理账号、模型和连接配置。" }
};

export const legacyRibbonSections = new Set<Section>(["workflow", "imageStudio", "chat", "publish", "history"]);

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
  children,
  onNavigate,
  onRefreshHealth
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentCopy = sectionCopy[section] ?? sectionCopy.workspace!;
  const activeAccount =
    settings.accounts.find((account) => account.id === settings.activeAccountId) ?? settings.accounts[0];
  const runningCount = jobs.filter((job) => job.status === "queued" || job.status === "running").length;

  const navigate = (next: Section) => {
    onNavigate(next);
    setMobileOpen(false);
  };

  return (
    <main className="appShell warmAppShell">
      <button
        className="mobileMenuButton"
        type="button"
        aria-label={mobileOpen ? "关闭导航" : "打开导航"}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((current) => !current)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={mobileOpen ? "sidebar open" : "sidebar"}>
        <div className="brandBlock">
          <div className="brandMark">
            <BriefcaseBusiness size={19} />
          </div>
          <div>
            <div className="brandTitle">内容工作室</div>
            <div className="brandSubtitle">你的创作任务中心</div>
          </div>
        </div>

        <nav className="navList" aria-label="创作导航">
          {primaryNavigation.map((item) => (
            <NavigationButton
              item={item}
              active={section === item.id || (item.id === "research" && section === "flow")}
              key={item.id}
              onNavigate={navigate}
            />
          ))}
        </nav>

        <div className="navDivider" />
        <span className="navGroupLabel">管理</span>
        <nav className="navList utilityNav" aria-label="管理导航">
          {utilityNavigation.map((item) => (
            <NavigationButton
              item={item}
              active={section === item.id}
              key={item.id}
              onNavigate={navigate}
            />
          ))}
        </nav>

        <div className="sidebarAccount">
          <div className="accountLine">
            <span className={health?.loggedIn ? "accountDot online" : "accountDot"} />
            <div>
              <span>当前账号</span>
              <strong>{activeAccount?.displayName || "未配置账号"}</strong>
            </div>
            <button type="button" title="刷新连接状态" aria-label="刷新连接状态" onClick={onRefreshHealth}>
              <RefreshCw size={15} className={settingsBusy === "health" ? "spin" : ""} />
            </button>
          </div>
          <div className="connectionSummary">
            <span>{health?.loggedIn ? "已连接" : "未连接"}</span>
            <span>{modelReady ? "文案模型可用" : "文案模型未配置"}</span>
            <span>{imageReady ? "图片模型可用" : "图片模型未配置"}</span>
          </div>
        </div>
      </aside>

      {mobileOpen ? <button className="mobileNavScrim" aria-label="关闭导航" onClick={() => setMobileOpen(false)} /> : null}

      <section className="content">
        <header className="topbar">
          <div className="titleBlock">
            <p className="eyebrow">内容工作室</p>
            <h1>{currentCopy.title}</h1>
            <p className="pageSubtitle">{currentCopy.subtitle}</p>
          </div>
          <div className="topbarContext" aria-label="当前工作区状态">
            {runningCount ? <span>{runningCount} 个任务运行中</span> : null}
            {currentDraft ? <span>草稿已载入</span> : null}
            {assets.length ? <span>{assets.length} 个素材</span> : null}
          </div>
        </header>

        {notice ? <div className="noticeBar" role="status">{notice}</div> : null}
        {children}
      </section>
    </main>
  );
}

function NavigationButton({
  item,
  active,
  onNavigate
}: {
  item: NavigationItem;
  active: boolean;
  onNavigate: (section: Section) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      className={active ? "navItem active" : "navItem"}
      type="button"
      onClick={() => onNavigate(item.id)}
      aria-current={active ? "page" : undefined}
    >
      <Icon size={18} />
      <span>{item.label}</span>
    </button>
  );
}
