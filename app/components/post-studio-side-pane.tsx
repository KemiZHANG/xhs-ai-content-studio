"use client";

import type { ComponentProps } from "react";
import type { Section } from "@/app/types";
import type { PostSideDigest } from "@/app/components/post-side-digest";
import { PostStudioBriefTab, PostStudioEvidenceTab, PostStudioInsightsTab } from "@/app/components/post-studio-evidence-tabs";
import { PostStudioGeneratedTab, PostStudioReferencesTab } from "@/app/components/post-studio-media-tabs";
import { PostStudioPublishTab } from "@/app/components/post-studio-publish-tab";
import { PostStudioSideNavigator } from "@/app/components/post-studio-side-navigator";
import { PostStudioViralTab } from "@/app/components/post-studio-viral-tab";
import type { StudioTabGroup, StudioTabId } from "@/app/components/studio-tab-groups";
import type { StudioPage } from "@/app/components/studio-navigation";

export type StudioTab = StudioTabId;

export function PostStudioSidePane({
  activeTab,
  sideDigest,
  studioTabGroups,
  insights,
  brief,
  evidence,
  viral,
  references,
  generated,
  publish,
  page,
  onNavigate,
  onSelectTab
}: {
  activeTab: StudioTab;
  sideDigest: PostSideDigest;
  studioTabGroups: StudioTabGroup[];
  insights: ComponentProps<typeof PostStudioInsightsTab>;
  brief: ComponentProps<typeof PostStudioBriefTab>;
  evidence: ComponentProps<typeof PostStudioEvidenceTab>;
  viral: ComponentProps<typeof PostStudioViralTab>;
  references: ComponentProps<typeof PostStudioReferencesTab>;
  generated: ComponentProps<typeof PostStudioGeneratedTab>;
  publish: ComponentProps<typeof PostStudioPublishTab>;
  page?: StudioPage;
  onNavigate: (section: Section) => void;
  onSelectTab: (tab: StudioTab) => void;
}) {
  const allowedTabs: Partial<Record<StudioPage, StudioTab[]>> = {
    research: ["insights", "evidence", "viral"],
    visuals: ["references", "generated"],
    publish: ["publish"]
  };
  const visibleTabs = page ? allowedTabs[page] : undefined;
  const visibleGroups = visibleTabs
    ? studioTabGroups
        .map((group) => ({
          ...group,
          tabs: group.tabs.filter((tab) => visibleTabs.includes(tab.id))
        }))
        .filter((group) => group.tabs.length)
    : studioTabGroups;

  return (
    <aside className="panel studioSidePane">
      <PostStudioSideNavigator
        activeTab={activeTab}
        sideDigest={sideDigest}
        studioTabGroups={visibleGroups}
        compact={Boolean(page)}
        onSelectTab={onSelectTab}
      />

      {activeTab === "insights" ? <PostStudioInsightsTab {...insights} /> : null}
      {activeTab === "brief" ? <PostStudioBriefTab {...brief} /> : null}
      {activeTab === "evidence" ? <PostStudioEvidenceTab {...evidence} /> : null}
      {activeTab === "viral" ? <PostStudioViralTab {...viral} /> : null}
      {activeTab === "references" ? <PostStudioReferencesTab {...references} /> : null}
      {activeTab === "generated" ? <PostStudioGeneratedTab {...generated} /> : null}
      {activeTab === "publish" ? <PostStudioPublishTab {...publish} /> : null}

      {!page ? <details className="advancedEntry compactAdvancedEntry">
        <summary>
          <strong>高级 / 调试工具</strong>
          <span>日常创作留在 Post Studio；只有排查任务或单独批量处理时再展开。</span>
        </summary>
        <div className="advancedToolList">
          <button onClick={() => onNavigate("workflow")} type="button">
            <strong>独立主题研究</strong>
            <span>单独复查搜索条件和样本表。</span>
          </button>
          <button onClick={() => onNavigate("imageStudio")} type="button">
            <strong>高级图片工具</strong>
            <span>批量生成 AI 图片或图文卡片。</span>
          </button>
          <button onClick={() => onNavigate("jobs")} type="button">
            <strong>任务进度</strong>
            <span>查看后台长任务和失败原因。</span>
          </button>
          <button onClick={() => onNavigate("publish")} type="button">
            <strong>发布装配调试</strong>
            <span>备用入口；正式发布仍优先在本页确认。</span>
          </button>
        </div>
      </details> : null}
    </aside>
  );
}
