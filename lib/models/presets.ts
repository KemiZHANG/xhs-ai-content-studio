export type ModelProviderPreset = "gemini" | "openai" | "custom";

export type TextModelRoute = {
  textBaseUrl: string;
  textModel: string;
};

export type ImageModelRoute = {
  imageBaseUrl: string;
  imageModel: string;
};

type PresetDefinition = {
  label: string;
  description: string;
  text: TextModelRoute;
  image: ImageModelRoute;
};

export const modelProviderPresets: Record<Exclude<ModelProviderPreset, "custom">, PresetDefinition> = {
  gemini: {
    label: "Gemini",
    description: "推荐给普通用户：只需要填 Gemini API Key。",
    text: {
      textBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      textModel: "gemini-3-flash-preview"
    },
    image: {
      imageBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      imageModel: "gemini-2.5-flash-image"
    }
  },
  openai: {
    label: "OpenAI",
    description: "使用 OpenAI 官方接口，适合已有 OpenAI API Key 的用户。",
    text: {
      textBaseUrl: "https://api.openai.com/v1",
      textModel: "gpt-4o-mini"
    },
    image: {
      imageBaseUrl: "https://api.openai.com/v1",
      imageModel: "gpt-image-1"
    }
  }
};

export function applyTextProviderPreset<T extends TextModelRoute>(current: T, preset: ModelProviderPreset): T {
  if (preset === "custom") {
    return current;
  }
  return {
    ...current,
    ...modelProviderPresets[preset].text
  };
}

export function applyImageProviderPreset<T extends ImageModelRoute>(current: T, preset: ModelProviderPreset): T {
  if (preset === "custom") {
    return current;
  }
  return {
    ...current,
    ...modelProviderPresets[preset].image
  };
}

export function inferTextProviderPreset(route: TextModelRoute): ModelProviderPreset {
  const normalizedBaseUrl = normalizeUrl(route.textBaseUrl);
  const match = Object.entries(modelProviderPresets).find(
    ([, preset]) => normalizeUrl(preset.text.textBaseUrl) === normalizedBaseUrl && preset.text.textModel === route.textModel
  );
  return (match?.[0] as ModelProviderPreset | undefined) ?? "custom";
}

export function inferImageProviderPreset(route: ImageModelRoute): ModelProviderPreset {
  const normalizedBaseUrl = normalizeUrl(route.imageBaseUrl);
  const match = Object.entries(modelProviderPresets).find(
    ([, preset]) => normalizeUrl(preset.image.imageBaseUrl) === normalizedBaseUrl && preset.image.imageModel === route.imageModel
  );
  return (match?.[0] as ModelProviderPreset | undefined) ?? "custom";
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}
