import { describe, expect, it } from "vitest";
import { extractStageGuidanceDisplay } from "@/app/components/agent-stage-guidance";
import type { AgentResponseCard } from "@/app/types";

describe("agent stage guidance display", () => {
  it("extracts compact readiness steps from a stage guidance card", () => {
    const card: AgentResponseCard = {
      id: "card-stage-guidance",
      type: "stage_guidance",
      title: "Evidence ready",
      summary: "Next step: generate copy",
      data: {
        primaryAction: "generate_copy",
        readiness: {
          progress: 38.4,
          summary: "Still needs copy and images",
          visibleItems: [
            { label: "Evidence", ready: true, detail: "5 insights" },
            { label: "Copy", ready: false, detail: "Generate original copy", action: "generate_copy" },
            { label: "Images", ready: false, detail: "Select images", action: "generate_cards" }
          ]
        }
      }
    };

    const display = extractStageGuidanceDisplay(card);

    expect(display).toMatchObject({
      progress: 38,
      primaryAction: "generate_copy",
      summary: "Still needs copy and images"
    });
    expect(display?.items).toHaveLength(3);
    expect(display?.items[1]).toMatchObject({
      label: "Copy",
      ready: false,
      action: "generate_copy"
    });
  });

  it("ignores non-stage cards and malformed data", () => {
    expect(extractStageGuidanceDisplay({
      id: "copy",
      type: "copy_draft",
      title: "Draft",
      summary: "Draft"
    })).toBeNull();
    expect(extractStageGuidanceDisplay({
      id: "stage",
      type: "stage_guidance",
      title: "Stage",
      summary: "Stage",
      data: { readiness: { visibleItems: [] } }
    })).toBeNull();
  });
});
