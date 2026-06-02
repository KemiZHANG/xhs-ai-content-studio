"use client";

import type { PostSideDigest } from "@/app/components/post-side-digest";
import type { StudioTabGroup, StudioTabId } from "@/app/components/studio-tab-groups";

export function PostStudioSideNavigator({
  activeTab,
  sideDigest,
  studioTabGroups,
  onSelectTab
}: {
  activeTab: StudioTabId;
  sideDigest: PostSideDigest;
  studioTabGroups: StudioTabGroup[];
  onSelectTab: (tab: StudioTabId) => void;
}) {
  return (
    <>
      <div className="studioSideDigest">
        <div>
          <span>右侧工作区</span>
          <strong>{sideDigest.headline}</strong>
          <p>{sideDigest.detail}</p>
        </div>
        <button className="studioSideDigestPrimary" type="button" onClick={() => onSelectTab(sideDigest.primaryTab)}>
          <span>{sideDigest.primaryLabel}</span>
          <strong>{sideDigest.primaryReason}</strong>
        </button>
        <div className="studioSideDigestGrid">
          {sideDigest.cards.map((card) => (
            <button
              className={`studioSideDigestCard ${card.state} ${activeTab === card.tab ? "active" : ""}`}
              key={card.id}
              onClick={() => onSelectTab(card.tab)}
              type="button"
            >
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.detail}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="studioTabGroups" role="tablist" aria-label="右侧工作区分组">
        {studioTabGroups.map((group) => (
          <section className={group.active ? "studioTabGroup active" : "studioTabGroup"} key={group.id}>
            <div>
              <strong>{group.label}</strong>
              <span>{group.detail}</span>
            </div>
            <div className="studioTabs">
              {group.tabs.map((item) => (
                <button
                  aria-selected={item.active}
                  className={item.active ? "active" : ""}
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  role="tab"
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
