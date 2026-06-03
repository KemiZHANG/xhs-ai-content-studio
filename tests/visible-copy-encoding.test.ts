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
  "lib/post-project/readiness.ts",
  "docs/real-publish-acceptance.md"
];

const mojibakeSignals = [
  "�",
  "锟",
  "閻",
  "閸",
  "閺",
  "閹",
  "缁楁棁",
  "瀵板懐",
  "瀹歌尙",
  "鐠囦焦",
  "妞ゅ湱",
  "閸戝棗",
  "閺堫亙",
  "缂佹挻",
  "閺嶅洭",
  "娑撳秷",
  "鐪熷疄",
  "鍙戝竷",
  "楠屾敹",
  "灏忕孩涔",
  "纭",
  "浠呰嚜宸"
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
