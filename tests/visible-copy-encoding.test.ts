import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const guardedFiles = [
  "app/components/post-action-labels.ts",
  "app/components/post-canvas-panel.tsx",
  "app/components/post-flow-summary.ts",
  "app/components/post-next-step-coach.ts",
  "app/components/post-side-digest.ts",
  "app/components/post-studio-agent-pane.tsx",
  "app/components/post-studio-evidence-tabs.tsx",
  "app/components/post-studio-header-panel.tsx",
  "app/components/post-studio-media-tabs.tsx",
  "app/components/post-studio-status.ts",
  "app/components/post-studio-panel.tsx",
  "app/components/post-studio-publish-tab.tsx",
  "app/components/post-studio-side-pane.tsx",
  "app/components/post-studio-viral-tab.tsx",
  "app/components/studio-tab-groups.ts",
  "app/components/viral-evidence-summary.ts",
  "app/state/project-reset.ts",
  "app/api/viral-knowledge/route.ts",
  "lib/agent/orchestrator.ts",
  "lib/agent/planner.ts",
  "lib/agent/tools/registry.ts",
  "lib/rag/viral.ts",
  "lib/viral-knowledge/store.ts",
  "lib/post-project/guidance.ts",
  "lib/post-project/readiness.ts"
];

const mojibakeSignals = [
  "鐖",
  "鍥剧",
  "鏂囨",
  "鍙戝",
  "绗旇",
  "寰呯",
  "宸茬",
  "璇佹",
  "椤圭",
  "鍑嗗",
  "鏈",
  "鉁",
  "缁撴",
  "鏍囬",
  "涓嶈",
  "澶嶇敤"
];

describe("visible Post Studio copy encoding", () => {
  it("keeps core user-facing Chinese copy free from mojibake", () => {
    const offenders = guardedFiles.flatMap((file) => {
      const content = readFileSync(join(process.cwd(), file), "utf8");
      return mojibakeSignals
        .filter((signal) => content.includes(signal))
        .map((signal) => `${file}: ${signal}`);
    });

    expect(offenders).toEqual([]);
  });
});
