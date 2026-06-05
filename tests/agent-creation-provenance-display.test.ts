import { describe, expect, it } from "vitest";
import { extractAgentCreationProvenanceDisplay } from "@/app/components/agent-creation-provenance-display";
import type { AgentResponseCard } from "@/app/types";

describe("agent creation provenance display", () => {
  it("normalizes a creation provenance card for inline rendering", () => {
    const card: AgentResponseCard = {
      id: "card-creation-provenance",
      type: "creation_provenance",
      title: "创作依据完整",
      summary: "Brief、文案、图片方向 3/3 项可追溯",
      data: {
        headline: "创作依据完整",
        detail: "Brief、文案、图片方向 3/3 项可追溯；0 项需要补证据或人工确认。",
        items: [
          {
            id: "copy",
            label: "文案",
            status: "ready",
            summary: "标题、正文、标签、图片方向 4/4 个字段可追溯。",
            evidenceCount: 4,
            missingCount: 0,
            sourceCounts: { realtime: 2, viral_library: 1, user_input: 1 },
            weakViralEvidenceCount: 1
          }
        ]
      }
    };

    const display = extractAgentCreationProvenanceDisplay(card);

    expect(display?.headline).toBe("创作依据完整");
    expect(display?.items[0]).toMatchObject({
      label: "文案",
      status: "ready",
      weakViralEvidenceCount: 1,
      sourceLine: "实时 2 / 爆款库 1（弱参考 1） / 用户输入 1"
    });
  });

  it("ignores unrelated cards and malformed provenance payloads", () => {
    expect(extractAgentCreationProvenanceDisplay({
      id: "copy",
      type: "copy_draft",
      title: "标题",
      summary: "正文"
    })).toBeNull();

    expect(extractAgentCreationProvenanceDisplay({
      id: "bad",
      type: "creation_provenance",
      title: "bad",
      summary: "bad",
      data: { items: [{ status: "ready" }] }
    })).toBeNull();
  });
});
