import { describe, expect, it } from "vitest";
import { getStudioDestination } from "@/app/components/studio-navigation";

describe("getStudioDestination", () => {
  it("starts an empty project in research", () => {
    expect(getStudioDestination("empty")).toMatchObject({
      page: "research",
      title: "先确定内容方向",
      actionLabel: "开始研究"
    });
  });

  it("moves a drafted project to images", () => {
    expect(getStudioDestination("copy_ready").page).toBe("visuals");
  });

  it("moves an assembled project to publish", () => {
    expect(getStudioDestination("assembling").page).toBe("publish");
  });

  it("keeps evidence and brief work in copy", () => {
    expect(getStudioDestination("evidence_ready").page).toBe("compose");
    expect(getStudioDestination("brief_ready").page).toBe("compose");
  });
});
