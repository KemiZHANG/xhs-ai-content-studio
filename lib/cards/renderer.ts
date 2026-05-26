import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { generatedDir } from "@/lib/storage/assets";

const execFileAsync = promisify(execFile);

export type CardTheme = "sketch" | "default" | "professional" | "retro" | "terminal" | "botanical" | "neo-brutalism" | "playful-geometric";
export type CardPaginationMode = "separator" | "auto-split" | "auto-fit" | "dynamic";

export type CardPage = {
  kind: "cover" | "content";
  title: string;
  subtitle?: string;
  body: string;
  tags: string[];
  index: number;
};

export type RenderXhsCardInput = {
  title: string;
  subtitle?: string;
  body: string;
  tags?: string[];
  theme?: CardTheme;
  mode?: CardPaginationMode;
  width?: number;
  height?: number;
  maxHeight?: number;
  dpr?: number;
};

export type RenderedCardFile = {
  kind: CardPage["kind"];
  title: string;
  absolutePath: string;
  mimeType: "image/png";
  size: number;
  pageIndex: number;
};

export type RenderXhsCardResult = {
  pages: CardPage[];
  files: RenderedCardFile[];
  theme: CardTheme;
  mode: CardPaginationMode;
  width: number;
  height: number;
};

export type CardRasterizer = (input: {
  html: string;
  outputPath: string;
  width: number;
  height: number;
  dpr: number;
}) => Promise<void>;

export function buildCardPages(input: Pick<RenderXhsCardInput, "title" | "subtitle" | "body" | "tags" | "mode">): CardPage[] {
  const title = input.title.trim() || "小红书笔记";
  const tags = normalizeTags(input.tags ?? []);
  const bodyParts = splitBodyIntoCards(input.body, input.mode ?? "auto-split");
  const coverBody = [input.subtitle?.trim(), tags.length ? tags.map((tag) => `#${tag}`).join(" ") : ""]
    .filter(Boolean)
    .join("\n");

  return [
    {
      kind: "cover",
      title,
      subtitle: input.subtitle?.trim(),
      body: coverBody,
      tags,
      index: 0
    },
    ...bodyParts.map((body, index) => ({
      kind: "content" as const,
      title,
      subtitle: input.subtitle?.trim(),
      body,
      tags,
      index: index + 1
    }))
  ];
}

export async function renderXhsCardSet(
  input: RenderXhsCardInput,
  options: { outputDir?: string; rasterizer?: CardRasterizer } = {}
): Promise<RenderXhsCardResult> {
  const theme = input.theme ?? "sketch";
  const mode = input.mode ?? "auto-split";
  const width = clamp(input.width ?? 1080, 720, 2160);
  const height = clamp(input.height ?? 1440, 960, 3840);
  const dpr = clamp(input.dpr ?? 1, 1, 3);
  const outputDir = options.outputDir ?? generatedDir();
  const rasterizer = options.rasterizer ?? rasterizeWithChrome;
  const pages = buildCardPages({ ...input, mode });
  const slug = safeSlug(input.title || "xhs-card");

  await mkdir(outputDir, { recursive: true });

  const files: RenderedCardFile[] = [];
  for (const page of pages) {
    const filename = `${Date.now()}-${slug}-${page.kind === "cover" ? "cover" : `card-${page.index}`}.png`;
    const outputPath = path.join(outputDir, filename);
    const html = buildCardHtml(page, { theme, width, height });
    await rasterizer({ html, outputPath, width, height, dpr });
    const fileStat = await stat(outputPath);
    files.push({
      kind: page.kind,
      title: page.kind === "cover" ? "封面卡片" : `正文卡片 ${page.index}`,
      absolutePath: outputPath,
      mimeType: "image/png",
      size: fileStat.size,
      pageIndex: page.index
    });
  }

  return { pages, files, theme, mode, width, height };
}

export function buildCardHtml(page: CardPage, options: { theme: CardTheme; width: number; height: number }): string {
  const theme = themeTokens[options.theme] ?? themeTokens.sketch;
  const paragraphs = page.body
    .split(/\n{2,}|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const isCover = page.kind === "cover";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${options.width}, initial-scale=1" />
  <meta name="xhs-note-title" content="${escapeHtml(page.title)}" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: ${options.width}px; height: ${options.height}px; overflow: hidden; }
    body {
      align-items: center;
      background: ${theme.outer};
      color: ${theme.text};
      display: flex;
      font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif;
      justify-content: center;
      letter-spacing: 0;
    }
    .card {
      background: ${theme.inner};
      border: ${theme.border};
      border-radius: ${theme.radius}px;
      box-shadow: ${theme.shadow};
      display: flex;
      flex-direction: column;
      height: calc(100% - 96px);
      justify-content: ${isCover ? "center" : "flex-start"};
      overflow: hidden;
      padding: ${isCover ? "92px 84px" : "72px 76px"};
      position: relative;
      width: calc(100% - 96px);
    }
    .eyebrow {
      color: ${theme.accent};
      font-size: ${isCover ? 34 : 26}px;
      font-weight: 800;
      margin-bottom: ${isCover ? 34 : 22}px;
    }
    h1 {
      color: ${theme.heading};
      font-size: ${isCover ? 92 : 54}px;
      line-height: 1.08;
      margin: 0;
      max-width: 880px;
      overflow-wrap: anywhere;
    }
    .subtitle {
      color: ${theme.muted};
      font-size: ${isCover ? 40 : 28}px;
      font-weight: 700;
      line-height: 1.45;
      margin-top: 28px;
      overflow-wrap: anywhere;
    }
    .content {
      display: grid;
      gap: 24px;
      margin-top: 34px;
    }
    .content p {
      background: ${theme.block};
      border: ${theme.blockBorder};
      border-radius: 28px;
      font-size: ${isCover ? 34 : 36}px;
      line-height: 1.55;
      margin: 0;
      overflow-wrap: anywhere;
      padding: ${isCover ? "18px 24px" : "22px 28px"};
    }
    .tags {
      bottom: 54px;
      color: ${theme.accent};
      display: flex;
      flex-wrap: wrap;
      font-size: 28px;
      font-weight: 800;
      gap: 14px;
      left: 76px;
      position: absolute;
      right: 76px;
    }
    .mark {
      border: ${theme.markBorder};
      border-radius: 999px;
      height: 92px;
      position: absolute;
      right: 54px;
      top: 54px;
      width: 92px;
    }
    .page {
      bottom: 54px;
      color: ${theme.muted};
      font-size: 24px;
      font-weight: 700;
      position: absolute;
      right: 76px;
    }
  </style>
</head>
<body>
  <main class="card">
    <i class="mark"></i>
    <div class="eyebrow">${escapeHtml(isCover ? "XHS NOTE" : `PART ${page.index}`)}</div>
    <h1>${escapeHtml(isCover ? page.title : headlineForContent(page.body, page.index))}</h1>
    ${isCover && page.subtitle ? `<div class="subtitle">${escapeHtml(page.subtitle)}</div>` : ""}
    <section class="content">
      ${paragraphs.slice(0, isCover ? 3 : 8).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
    </section>
    ${
      page.tags.length
        ? `<div class="tags">${page.tags.slice(0, 8).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div>`
        : ""
    }
    ${isCover ? "" : `<div class="page">${page.index}</div>`}
  </main>
</body>
</html>`;
}

async function rasterizeWithChrome(input: {
  html: string;
  outputPath: string;
  width: number;
  height: number;
  dpr: number;
}): Promise<void> {
  const chrome = findChromeExecutable();
  if (!chrome) {
    throw new Error("未找到 Chrome/Edge，无法渲染图文卡片 PNG。请安装 Chrome 或 Edge 后重试。");
  }

  const actualTempDir = await mkdtemp(path.join(os.tmpdir(), "xhs-card-render-"));
  const htmlPath = path.join(actualTempDir, "card.html");
  await writeFile(htmlPath, input.html, "utf8");

  try {
    await execFileAsync(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--force-device-scale-factor=${input.dpr}`,
      `--window-size=${input.width},${input.height}`,
      `--screenshot=${input.outputPath}`,
      pathToFileUrl(htmlPath)
    ]);
  } finally {
    await rm(actualTempDir, { recursive: true, force: true });
  }
}

function splitBodyIntoCards(body: string, mode: CardPaginationMode): string[] {
  const clean = body.trim() || "请补充正文内容。";
  if (mode === "separator") {
    return clean
      .split(/\n\s*---\s*\n/g)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  if (mode === "auto-fit") {
    return [clean];
  }

  const maxChars = mode === "dynamic" ? 420 : 260;
  const paragraphs = clean
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const pages: string[] = [];
  let current = "";

  for (const paragraph of paragraphs.length ? paragraphs : [clean]) {
    if (!current) {
      current = paragraph;
      continue;
    }

    if (`${current}\n\n${paragraph}`.length > maxChars) {
      pages.push(current);
      current = paragraph;
    } else {
      current = `${current}\n\n${paragraph}`;
    }
  }

  if (current) pages.push(current);
  return pages.flatMap((page) => hardSplit(page, maxChars));
}

function hardSplit(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += maxChars) {
    chunks.push(text.slice(index, index + maxChars));
  }
  return chunks;
}

function headlineForContent(body: string, index: number): string {
  const firstLine = body.split(/\n/).map((line) => line.trim()).find(Boolean);
  if (!firstLine) return `正文卡片 ${index}`;
  return firstLine.replace(/^#+\s*/, "").slice(0, 18);
}

function normalizeTags(tags: string[]): string[] {
  return tags.map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean);
}

function safeSlug(value: string): string {
  return value.replace(/[^\w\u4e00-\u9fa5-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "xhs-card";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function pathToFileUrl(filePath: string): string {
  return `file:///${filePath.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1:")}`;
}

function findChromeExecutable(): string | null {
  const candidates =
    process.platform === "win32"
      ? [
          path.join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
          path.join(process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
          path.join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
          path.join(process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe")
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Chromium.app/Contents/MacOS/Chromium"
          ]
        : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

const themeTokens: Record<CardTheme, {
  outer: string;
  inner: string;
  block: string;
  text: string;
  heading: string;
  accent: string;
  muted: string;
  border: string;
  blockBorder: string;
  markBorder: string;
  radius: number;
  shadow: string;
}> = {
  sketch: {
    outer: "#f3f1ea",
    inner: "#fffdf6",
    block: "#f8f1e7",
    text: "#24211d",
    heading: "#1f1c18",
    accent: "#0f7f72",
    muted: "#70685f",
    border: "3px solid #2f2a24",
    blockBorder: "2px dashed rgba(47,42,36,.22)",
    markBorder: "3px solid rgba(15,127,114,.55)",
    radius: 44,
    shadow: "18px 22px 0 rgba(47,42,36,.15)"
  },
  default: {
    outer: "linear-gradient(135deg,#f3f3f3,#fafafa)",
    inner: "#ffffff",
    block: "#f5f5f5",
    text: "#202020",
    heading: "#111111",
    accent: "#0d7f72",
    muted: "#666666",
    border: "1px solid #dddddd",
    blockBorder: "1px solid #e5e5e5",
    markBorder: "2px solid rgba(13,127,114,.35)",
    radius: 34,
    shadow: "0 24px 70px rgba(0,0,0,.12)"
  },
  professional: {
    outer: "#edf3f7",
    inner: "#ffffff",
    block: "#eef5fb",
    text: "#1c2730",
    heading: "#0f2b45",
    accent: "#2878a8",
    muted: "#667989",
    border: "1px solid #d8e6ef",
    blockBorder: "1px solid #d8e6ef",
    markBorder: "2px solid rgba(40,120,168,.45)",
    radius: 24,
    shadow: "0 24px 80px rgba(15,43,69,.14)"
  },
  retro: {
    outer: "#f3dfc7",
    inner: "#fff6df",
    block: "#f4d7ae",
    text: "#3b2418",
    heading: "#33190f",
    accent: "#b4512f",
    muted: "#7c5b45",
    border: "3px solid #3b2418",
    blockBorder: "2px solid rgba(59,36,24,.22)",
    markBorder: "3px solid rgba(180,81,47,.55)",
    radius: 18,
    shadow: "16px 16px 0 rgba(59,36,24,.18)"
  },
  terminal: {
    outer: "#111314",
    inner: "#191d1f",
    block: "#0e1112",
    text: "#e9f8ec",
    heading: "#e9f8ec",
    accent: "#39d98a",
    muted: "#98a79f",
    border: "1px solid #39d98a",
    blockBorder: "1px solid rgba(57,217,138,.25)",
    markBorder: "2px solid rgba(57,217,138,.75)",
    radius: 18,
    shadow: "0 26px 80px rgba(0,0,0,.45)"
  },
  botanical: {
    outer: "#e5efe5",
    inner: "#fbfff7",
    block: "#edf6e8",
    text: "#223524",
    heading: "#18371e",
    accent: "#4b8a50",
    muted: "#6a7d66",
    border: "1px solid #b9d6b7",
    blockBorder: "1px solid #cce2c7",
    markBorder: "2px solid rgba(75,138,80,.55)",
    radius: 38,
    shadow: "0 24px 80px rgba(24,55,30,.14)"
  },
  "neo-brutalism": {
    outer: "#f7ef4a",
    inner: "#ffffff",
    block: "#f5f5f5",
    text: "#111111",
    heading: "#111111",
    accent: "#f14f2b",
    muted: "#333333",
    border: "5px solid #111111",
    blockBorder: "4px solid #111111",
    markBorder: "5px solid #111111",
    radius: 0,
    shadow: "18px 18px 0 #111111"
  },
  "playful-geometric": {
    outer: "#fbe8ef",
    inner: "#fffafc",
    block: "#fff1a8",
    text: "#28212c",
    heading: "#28212c",
    accent: "#159a91",
    muted: "#7a6375",
    border: "2px solid #28212c",
    blockBorder: "2px solid rgba(40,33,44,.2)",
    markBorder: "3px solid #159a91",
    radius: 42,
    shadow: "16px 20px 0 rgba(21,154,145,.18)"
  }
};
