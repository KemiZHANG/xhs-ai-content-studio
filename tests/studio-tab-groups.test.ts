import { describe, expect, it } from "vitest";
import { buildStudioTabGroups, getRecommendedStudioTabForStage } from "@/app/components/studio-tab-groups";

describe("studio tab groups", () => {
  it("compresses internal tabs into three user-facing workflow groups", () => {
    const groups = buildStudioTabGroups("generated");

    expect(groups.map((group) => group.label)).toEqual(["需求与证据", "文案与图片", "发布检查"]);
    expect(groups).toHaveLength(3);
    expect(groups[0].tabs.map((tab) => tab.id)).toEqual(["insights", "brief", "evidence", "viral"]);
    expect(groups[1]).toMatchObject({
      id: "creation",
      active: true
    });
    expect(groups[1].tabs.find((tab) => tab.id === "generated")).toMatchObject({ active: true });
  });

  it("keeps publish checks visually separate from evidence and image work", () => {
    const groups = buildStudioTabGroups("publish");
    const activeGroups = groups.filter((group) => group.active);

    expect(activeGroups).toEqual([
      expect.objectContaining({
        id: "publish",
        label: "发布检查",
        tabs: [expect.objectContaining({ id: "publish", active: true })]
      })
    ]);
  });

  it("recommends the side tab that matches the current PostProject stage", () => {
    expect(getRecommendedStudioTabForStage("researching")).toBe("insights");
    expect(getRecommendedStudioTabForStage("brief_ready")).toBe("brief");
    expect(getRecommendedStudioTabForStage("image_generating")).toBe("generated");
    expect(getRecommendedStudioTabForStage("reviewing")).toBe("publish");
  });
});
