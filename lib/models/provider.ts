import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppSettings } from "@/lib/storage/settings";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GeneratedImage = {
  path?: string;
  url?: string;
};

export type ModelProvider = {
  generateStructuredText(prompt: string, system?: string): Promise<string>;
  analyzeImageStyle(prompt: string, imageUrls: string[]): Promise<string>;
  analyzeLocalImages?(prompt: string, imagePaths: string[]): Promise<string>;
  generateImage(prompt: string): Promise<GeneratedImage | null>;
  generateImageFromReference(prompt: string, imagePaths: string[]): Promise<GeneratedImage | null>;
};

export type ReferenceImagePromptInput = {
  productName: string;
  sellingPoints: string;
  scene: string;
  style: string;
  extraPrompt?: string;
};

export function buildReferenceImagePrompt(input: ReferenceImagePromptInput): string {
  return `基于参考产品图生成一张新的小红书图片。

产品名称：${input.productName}
卖点：${input.sellingPoints}
场景：${input.scene}
风格：${input.style}
补充要求：${input.extraPrompt || "无"}

要求：
1. 保持产品主体一致，不改变产品核心外观、包装、标签位置、轮廓、颜色和材质。
2. 产品必须是画面主角，清晰完整、不被手、人、道具或文字遮挡。
3. 生成新的真实使用场景或讲解图，不直接复制原图背景；参考图只能学习氛围、光线和构图。
4. 如果原包装文字无法准确复现，就让文字变柔和或不可读，不要凭空生成错误文字、错误品牌、错误认证或促销贴纸。
5. 适合小红书发布，真实摄影感、自然光、轻微生活痕迹，避免塑料感和过度精修。
6. 不要使用竞品 logo、虚假认证标识、夸大医疗/功效声明。`;
}

export function createModelProvider(settings: AppSettings): ModelProvider {
  return {
    async generateStructuredText(prompt, system) {
      if (!settings.textApiKey.trim()) {
        throw new Error("Text model API key is not configured");
      }

      const response = await fetch(`${trimSlash(settings.textBaseUrl)}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.textApiKey}`
        },
        body: JSON.stringify({
          model: settings.textModel,
          messages: [
            {
              role: "system",
              content:
                system ??
                "You are a Xiaohongshu content analyst. Return practical, original, platform-aware Chinese content."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Text model request failed with HTTP ${response.status}: ${body.slice(0, 300)}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      return payload.choices?.[0]?.message?.content?.trim() ?? "";
    },

    async analyzeImageStyle(prompt, imageUrls) {
      if (!settings.textApiKey.trim()) {
        throw new Error("Text model API key is not configured");
      }

      if (!imageUrls.length) {
        return "";
      }

      const response = await fetch(`${trimSlash(settings.textBaseUrl)}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.textApiKey}`
        },
        body: JSON.stringify({
          model: settings.textModel,
          messages: [
            {
              role: "system",
              content:
                "You analyze Xiaohongshu image style. Extract reusable visual patterns without copying the original images."
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: prompt
                },
                ...imageUrls.slice(0, 8).map((url) => ({
                  type: "image_url",
                  image_url: {
                    url
                  }
                }))
              ]
            }
          ],
          temperature: 0.4
        })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Image style analysis failed with HTTP ${response.status}: ${body.slice(0, 300)}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      return payload.choices?.[0]?.message?.content?.trim() ?? "";
    },

    async analyzeLocalImages(prompt, imagePaths) {
      if (!settings.textApiKey.trim()) {
        throw new Error("Text model API key is not configured");
      }

      if (!imagePaths.length) {
        return "";
      }

      const inlineImages = await Promise.all(
        imagePaths.slice(0, 4).map(async (filePath) => {
          const bytes = await readFile(filePath);
          return {
            type: "image_url",
            image_url: {
              url: `data:${mimeFromPath(filePath)};base64,${bytes.toString("base64")}`
            }
          };
        })
      );

      const response = await fetch(`${trimSlash(settings.textBaseUrl)}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.textApiKey}`
        },
        body: JSON.stringify({
          model: settings.textModel,
          messages: [
            {
              role: "system",
              content:
                "You analyze user-provided product/reference images for Xiaohongshu content creation. Be concrete and do not invent unreadable text."
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: prompt
                },
                ...inlineImages
              ]
            }
          ],
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Local image analysis failed with HTTP ${response.status}: ${body.slice(0, 300)}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      return payload.choices?.[0]?.message?.content?.trim() ?? "";
    },

    async generateImage(prompt) {
      if (!settings.imageApiKey.trim()) {
        return null;
      }

      const response = await fetch(`${trimSlash(settings.imageBaseUrl)}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.imageApiKey}`
        },
        body: JSON.stringify({
          model: settings.imageModel,
          prompt,
          size: "1024x1024",
          response_format: "b64_json",
          n: 1
        })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Image model request failed with HTTP ${response.status}: ${body.slice(0, 300)}`);
      }

      const payload = (await response.json()) as {
        data?: Array<{ b64_json?: string; url?: string }>;
      };
      const image = payload.data?.[0];
      if (!image) {
        return null;
      }

      if (image.url) {
        return { url: image.url };
      }

      if (image.b64_json) {
        const dir = path.join(process.cwd(), "generated-assets");
        await mkdir(dir, { recursive: true });
        const filePath = path.join(dir, `xhs-image-${Date.now()}.png`);
        await writeFile(filePath, Buffer.from(image.b64_json, "base64"));
        return { path: filePath };
      }

      return null;
    },

    async generateImageFromReference(prompt, imagePaths) {
      if (!settings.imageApiKey.trim()) {
        return null;
      }

      if (!imagePaths.length) {
        return this.generateImage(prompt);
      }

      if (!settings.imageBaseUrl.includes("generativelanguage.googleapis.com")) {
        return this.generateImage(`${prompt}\n\nReference images were provided in the local app, but this provider path only supports text-to-image.`);
      }

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${settings.imageModel}:generateContent?key=${settings.imageApiKey}`;
      const inlineParts = await Promise.all(
        imagePaths.slice(0, 4).map(async (filePath) => {
          const bytes = await readFile(filePath);
          return {
            inlineData: {
              mimeType: mimeFromPath(filePath),
              data: bytes.toString("base64")
            }
          };
        })
      );

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                },
                ...inlineParts
              ]
            }
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"]
          }
        })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Reference image generation failed with HTTP ${response.status}: ${body.slice(0, 300)}`);
      }

      const payload = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              inlineData?: { data?: string; mimeType?: string };
              inline_data?: { data?: string; mime_type?: string };
            }>;
          };
        }>;
      };
      const parts = payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];
      const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
      const data = imagePart?.inlineData?.data ?? imagePart?.inline_data?.data;
      const mimeType = imagePart?.inlineData?.mimeType ?? imagePart?.inline_data?.mime_type ?? "image/png";

      if (!data) {
        return null;
      }

      const dir = path.join(process.cwd(), "generated-assets", "generated");
      await mkdir(dir, { recursive: true });
      const extension = mimeType.includes("jpeg") ? "jpg" : "png";
      const filePath = path.join(dir, `product-scene-${Date.now()}.${extension}`);
      await writeFile(filePath, Buffer.from(data, "base64"));
      return { path: filePath };
    }
  };
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function mimeFromPath(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/png";
}
