import { labelForPostAction } from "@/app/components/post-action-labels";
import type { PostStageGuidance } from "@/lib/post-project/guidance";
import type { PostReadinessReport } from "@/lib/post-project/readiness";
import type { PostAction } from "@/lib/post-project/types";

export type PostNextStepCoach = {
  headline: string;
  detail: string;
  primaryAction?: PostAction;
  primaryLabel?: string;
  secondaryActions: Array<{
    action: PostAction;
    label: string;
  }>;
  blockerLine?: string;
  progressLine?: string;
};

export function buildPostNextStepCoach({
  guidance,
  readiness,
  nextActions
}: {
  guidance: PostStageGuidance;
  readiness: PostReadinessReport | null;
  nextActions: PostAction[];
}): PostNextStepCoach {
  const primaryAction = readiness?.nextAction ?? guidance.primaryAction ?? nextActions[0];
  const blocker = readiness?.blockers[0];
  const secondaryActions = nextActions
    .filter((action) => action !== primaryAction)
    .slice(0, 2)
    .map((action) => ({ action, label: labelForPostAction(action) }));

  return {
    headline: guidance.title,
    detail: blocker
      ? `${guidance.description} 当前最需要补齐：${blocker.label}。${blocker.detail}`
      : guidance.description,
    primaryAction,
    primaryLabel: primaryAction ? labelForPostAction(primaryAction) : undefined,
    secondaryActions,
    blockerLine: blocker ? `阻塞项：${blocker.label}` : undefined,
    progressLine: readiness ? `准备度 ${readiness.progress}% · ${readiness.summary}` : undefined
  };
}
