import { describe, expect, it } from "vitest";
import { buildEvidenceReferenceNote, selectEvidenceReferenceInsights } from "@/lib/post-project/evidence-note";
import type { EvidenceInsight } from "@/lib/post-project/types";

function insight(id: string, sourceType: EvidenceInsight["sourceType"], type: EvidenceInsight["type"], confidence: number): EvidenceInsight {
  return {
    id,
    sourceType,
    type,
    insight: `${id} reusable learning`,
    sourceSampleIds: [id.replace("insight", "sample")],
    confidence,
    createdAt: "2026-05-31T00:00:00.000Z"
  };
}

describe("evidence reference note", () => {
  it("keeps viral-library RAG evidence visible even when realtime evidence dominates the pack", () => {
    const insights = [
      insight("live-title", "realtime", "title", 0.96),
      insight("live-copy", "realtime", "copy", 0.95),
      insight("live-tag", "realtime", "tag", 0.94),
      insight("live-visual", "realtime", "visual", 0.93),
      insight("live-comment", "realtime", "comment", 0.92),
      insight("viral-hook", "viral_library", "hook", 0.7),
      insight("user-angle", "user_input", "audience", 0.68)
    ];

    const selected = selectEvidenceReferenceInsights(insights, 5);
    const note = buildEvidenceReferenceNote(insights, 5);

    expect(selected.map((item) => item.id)).toContain("viral-hook");
    expect(selected.map((item) => item.id)).toContain("user-angle");
    expect(note).toContain("证据构成：实时研究 5 / 爆款库 1 / 用户输入 1");
    expect(note).toContain("viral-hook｜爆款库｜hook");
    expect(note).toContain("user-angle｜用户输入｜audience");
  });

  it("returns a clear no-evidence warning instead of pretending research exists", () => {
    expect(buildEvidenceReferenceNote([])).toContain("当前 PostProject 没有可追溯 evidencePack 结论");
  });
});
