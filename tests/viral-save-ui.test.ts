import { describe, expect, it } from "vitest";
import { formatViralSaveError } from "@/app/state/viral-save";

describe("viral save UI feedback", () => {
  it("explains rejected low-quality samples instead of showing a generic failure", () => {
    const message = formatViralSaveError({
      data: {
        error: "没有达到爆款库入库质量门槛的样本",
        candidateReviews: [{
          sampleId: "weak-note",
          shouldSave: false,
          warnings: ["互动数据太低", "正文信息不足"]
        }],
        skippedSampleIds: ["weak-note"]
      }
    });

    expect(message).toContain("没有达到爆款库入库质量门槛");
    expect(message).toContain("weak-note");
    expect(message).toContain("互动数据太低");
    expect(message).toContain("强制保存/弱参考");
  });
});
