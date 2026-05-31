import { describe, expect, it } from "vitest";
import { labelForPostAction } from "@/app/components/post-action-labels";
import { modeLabel, subtitleForSection } from "@/app/components/xhs-display-utils";

describe("post action labels", () => {
  it("keeps publish shortcuts framed as confirmation generation", () => {
    expect(labelForPostAction("request_publish_confirmation")).toBe("生成发布确认单");
    expect(labelForPostAction("schedule_publish")).toBe("生成定时发布确认单");
    expect(labelForPostAction("publish_now")).toBe("生成立即发布确认单");
  });

  it("keeps workflow mode labels clear before real external publishing", () => {
    expect(modeLabel("publish")).toBe("生成发布确认单");
    expect(modeLabel("schedule")).toBe("生成定时确认单");
    expect(subtitleForSection("publish")).toContain("先生成确认单");
  });
});
