export type DigestStudioTab = "insights" | "brief" | "evidence" | "viral" | "references" | "generated" | "publish";

export type PostSideDigestCard = {
  id: "evidence" | "assets" | "publish" | "focus";
  label: string;
  value: string;
  detail: string;
  state: "ready" | "warn" | "neutral";
  tab: DigestStudioTab;
};

export type PostSideDigest = {
  headline: string;
  detail: string;
  cards: PostSideDigestCard[];
};

export function buildPostSideDigest({
  insightCount,
  realtimeInsightCount,
  viralInsightCount,
  hasBrief,
  selectedImageCount,
  generatedImageCount,
  referenceImageCount,
  publishReady,
  accountReady,
  qualityFresh,
  activeTab
}: {
  insightCount: number;
  realtimeInsightCount: number;
  viralInsightCount: number;
  hasBrief: boolean;
  selectedImageCount: number;
  generatedImageCount: number;
  referenceImageCount: number;
  publishReady: boolean;
  accountReady: boolean;
  qualityFresh: boolean;
  activeTab: DigestStudioTab;
}): PostSideDigest {
  const evidenceReady = insightCount > 0 && hasBrief;
  const assetReady = selectedImageCount > 0;
  const publishState: PostSideDigestCard["state"] = publishReady
    ? "ready"
    : accountReady && qualityFresh
      ? "neutral"
      : "warn";

  const cards: PostSideDigestCard[] = [
    {
      id: "evidence",
      label: "证据策略",
      value: insightCount ? `${insightCount} 条规律` : "待研究",
      detail: evidenceReady
        ? `实时 ${realtimeInsightCount} / 爆款库 ${viralInsightCount}，Brief 已生成。`
        : insightCount
          ? "已有规律，下一步压缩成 CreativeBrief。"
          : "先搜索真实笔记或检索爆款库。",
      state: evidenceReady ? "ready" : insightCount ? "neutral" : "warn",
      tab: hasBrief ? "brief" : insightCount ? "insights" : "evidence"
    },
    {
      id: "assets",
      label: "图片素材",
      value: selectedImageCount ? `${selectedImageCount} 张已选` : "待选图",
      detail: selectedImageCount
        ? "已选图片会进入最终帖子。"
        : generatedImageCount
          ? `有 ${generatedImageCount} 张生成图，先选发布图。`
          : referenceImageCount
            ? `有 ${referenceImageCount} 张参考图，可生成场景图或卡片。`
            : "上传产品图，或让 Agent 生成配图/卡片。",
      state: assetReady ? "ready" : generatedImageCount || referenceImageCount ? "neutral" : "warn",
      tab: generatedImageCount ? "generated" : "references"
    },
    {
      id: "publish",
      label: "发布安全",
      value: publishReady ? "可生成确认单" : "未就绪",
      detail: publishReady
        ? "仍需人工确认账号、版本、可见范围和时间。"
        : accountReady
          ? qualityFresh
            ? "内容未完全装配，继续补齐图片/证据/确认单。"
            : "先运行或刷新 Quality Gate。"
          : "先检测当前小红书账号登录状态。",
      state: publishState,
      tab: "publish"
    },
    {
      id: "focus",
      label: "当前面板",
      value: labelForStudioTab(activeTab),
      detail: "完整原始样本、搜索过滤和审计日志默认收起，需要时再展开。",
      state: "neutral",
      tab: activeTab
    }
  ];

  const firstWarn = cards.find((card) => card.state === "warn");
  return {
    headline: firstWarn ? `先处理：${firstWarn.label}` : "右侧素材和证据已收口",
    detail: firstWarn?.detail ?? "默认只展示关键证据、当前图片和发布阻塞项，完整数据保留在详情里。",
    cards
  };
}

function labelForStudioTab(tab: DigestStudioTab): string {
  const labels: Record<DigestStudioTab, string> = {
    insights: "可学习结论",
    brief: "CreativeBrief",
    evidence: "研究证据",
    viral: "爆款库",
    references: "图片参考",
    generated: "生成素材",
    publish: "发布检查"
  };
  return labels[tab];
}
