import type { AppSettings } from "@/lib/storage/settings";
import type { AssetRecord } from "@/lib/storage/assets";

export type PublishVisibility = AppSettings["defaultVisibility"];

export type PublishAssemblyInput = {
  title: string;
  content: string;
  tags: string[];
  visibility: PublishVisibility;
  assets: AssetRecord[];
  scheduleAt?: string;
};

export type PublishContentArgs = {
  title: string;
  content: string;
  tags: string[];
  images: string[];
  visibility: PublishVisibility;
  scheduleAt?: string;
};

export function validatePublishAssembly(input: PublishAssemblyInput): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) {
    errors.push("请填写标题");
  }
  if (!input.content.trim()) {
    errors.push("请填写正文");
  }
  if (!compactTags(input.tags).length) {
    errors.push("请至少填写一个标签");
  }
  if (!input.assets.length) {
    errors.push("请至少选择一张要发布的图片");
  }
  return errors;
}

export function buildPublishContentArgs(input: PublishAssemblyInput): PublishContentArgs {
  const errors = validatePublishAssembly(input);
  if (errors.length) {
    throw new Error(errors.join("；"));
  }

  return {
    title: input.title.trim(),
    content: input.content.trim(),
    tags: compactTags(input.tags),
    images: input.assets.map((asset) => asset.absolutePath),
    visibility: input.visibility,
    scheduleAt: normalizeScheduleAt(input.scheduleAt)
  };
}

export function parseTagsText(value: string): string[] {
  return compactTags(value.split(/[#,，、\s]+/g));
}

function compactTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean))].slice(0, 20);
}

function normalizeScheduleAt(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed) ? `${trimmed}:00` : trimmed;
  return `${withSeconds}+08:00`;
}
