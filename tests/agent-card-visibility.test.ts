import { describe, expect, it } from "vitest";
import { isHighPriorityAgentCard, pickVisibleAgentCards } from "@/app/components/agent-card-visibility";
import type { AgentResponseCard } from "@/app/types";

function card(id: string, type: AgentResponseCard["type"]): AgentResponseCard {
  return { id, type, title: id, summary: id };
}

describe("agent card visibility", () => {
  it("surfaces the highest value cards first and caps the default view", () => {
    const visible = pickVisibleAgentCards([
      card("stage", "stage_guidance"),
      card("evidence", "evidence_summary"),
      card("copy", "copy_draft"),
      card("quality", "quality_check"),
      card("viral", "viral_knowledge"),
      card("publish", "publish_check")
    ]);

    expect(visible.map((item) => item.id)).toEqual(["quality", "publish", "copy", "viral"]);
  });

  it("keeps duplicate card types from flooding the visible strip", () => {
    const visible = pickVisibleAgentCards([
      card("copy-1", "copy_draft"),
      card("copy-2", "copy_draft"),
      card("copy-3", "copy_draft"),
      card("brief", "creative_brief"),
      card("image", "image_prompt")
    ]);

    expect(visible.map((item) => item.id)).toEqual(["copy-1", "brief", "image", "copy-2"]);
  });

  it("marks only decision-critical cards as high priority", () => {
    expect(isHighPriorityAgentCard("quality_check")).toBe(true);
    expect(isHighPriorityAgentCard("creative_brief")).toBe(true);
    expect(isHighPriorityAgentCard("evidence_summary")).toBe(false);
  });
});
