import { labelForPostAction } from "@/app/components/post-action-labels";
import type { PostReadinessReport, PostReadinessStepId } from "@/lib/post-project/readiness";
import type { PostAction } from "@/lib/post-project/types";

export type PostFlowPhaseId = "research" | "viral" | "brief" | "copy" | "visual" | "publish";

export type PostFlowPhase = {
  id: PostFlowPhaseId;
  label: string;
  detail: string;
  state: "done" | "active" | "todo";
  action?: PostAction;
  actionLabel?: string;
};

const phaseDefinitions: Array<{
  id: PostFlowPhaseId;
  label: string;
  stepIds: PostReadinessStepId[];
  doneDetail: string;
}> = [
  {
    id: "research",
    label: "实时研究",
    stepIds: ["evidence"],
    doneDetail: "真实笔记证据已沉淀"
  },
  {
    id: "viral",
    label: "爆款库",
    stepIds: ["viral_rag"],
    doneDetail: "爆款库规律已合入，或本次可选跳过"
  },
  {
    id: "brief",
    label: "Brief",
    stepIds: ["brief"],
    doneDetail: "文案和图片已共享同一份策略"
  },
  {
    id: "copy",
    label: "文案",
    stepIds: ["copy"],
    doneDetail: "标题正文可继续微调"
  },
  {
    id: "visual",
    label: "图片",
    stepIds: ["visual", "images"],
    doneDetail: "图片方向和选图已就绪"
  },
  {
    id: "publish",
    label: "检查发布",
    stepIds: ["assembly", "quality", "confirmation"],
    doneDetail: "发布计划已生成，或已通过确认"
  }
];

export function buildPostFlowSummary(readiness: PostReadinessReport | null): PostFlowPhase[] {
  if (!readiness) {
    return phaseDefinitions.map((phase, index) => ({
      id: phase.id,
      label: phase.label,
      detail: index === 0 ? "先输入主题并开始研究" : "等待前置步骤完成",
      state: index === 0 ? "active" : "todo"
    }));
  }

  const itemById = new Map(readiness.items.map((item) => [item.id, item]));
  const firstBlockerId = readiness.blockers[0]?.id;
  let activeAssigned = false;

  return phaseDefinitions.map((phase) => {
    const items = phase.stepIds.map((id) => itemById.get(id)).filter(Boolean);
    const readyCount = items.filter((item) => item?.ready).length;
    const allReady = Boolean(items.length) && readyCount === items.length;
    const blocker = items.find((item) => item?.id === firstBlockerId) ?? items.find((item) => item && !item.ready);
    const action = blocker?.action ?? items.find((item) => item?.action)?.action;
    const isActive = !allReady && !activeAssigned && Boolean(blocker || action);

    if (isActive) activeAssigned = true;

    return {
      id: phase.id,
      label: phase.label,
      detail: allReady
        ? phase.doneDetail
        : blocker?.detail ?? `已完成 ${readyCount}/${items.length} 项`,
      state: allReady ? "done" : isActive ? "active" : "todo",
      action,
      actionLabel: action ? labelForPostAction(action) : undefined
    };
  });
}
