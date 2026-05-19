import { describe, expect, it } from "vitest";
import {
  applyImageProviderPreset,
  applyTextProviderPreset,
  inferImageProviderPreset,
  inferTextProviderPreset
} from "@/lib/models/presets";

describe("model provider presets", () => {
  it("applies Gemini defaults so users only need to provide API keys", () => {
    expect(
      applyTextProviderPreset(
        {
          textBaseUrl: "",
          textModel: ""
        },
        "gemini"
      )
    ).toEqual({
      textBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      textModel: "gemini-3-flash-preview"
    });

    expect(
      applyImageProviderPreset(
        {
          imageBaseUrl: "",
          imageModel: ""
        },
        "gemini"
      )
    ).toEqual({
      imageBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      imageModel: "gemini-2.5-flash-image"
    });
  });

  it("applies OpenAI-compatible defaults", () => {
    expect(applyTextProviderPreset({ textBaseUrl: "", textModel: "" }, "openai").textBaseUrl).toBe(
      "https://api.openai.com/v1"
    );
    expect(applyImageProviderPreset({ imageBaseUrl: "", imageModel: "" }, "openai").imageModel).toBe("gpt-image-1");
  });

  it("keeps custom values untouched", () => {
    const text = { textBaseUrl: "https://example.com/v1", textModel: "custom-text" };
    const image = { imageBaseUrl: "https://example.com/v1", imageModel: "custom-image" };

    expect(applyTextProviderPreset(text, "custom")).toEqual(text);
    expect(applyImageProviderPreset(image, "custom")).toEqual(image);
  });

  it("infers presets from saved settings", () => {
    expect(
      inferTextProviderPreset({
        textBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        textModel: "gemini-3-flash-preview"
      })
    ).toBe("gemini");
    expect(
      inferImageProviderPreset({
        imageBaseUrl: "https://api.openai.com/v1",
        imageModel: "gpt-image-1"
      })
    ).toBe("openai");
    expect(inferTextProviderPreset({ textBaseUrl: "https://example.com", textModel: "custom" })).toBe("custom");
  });
});
