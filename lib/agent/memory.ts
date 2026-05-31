import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DraftRecord } from "@/lib/storage/drafts";
import type { OneClickResult } from "@/lib/workflows/one-click";

export type CreatorMemoryItem = {
  id: string;
  text: string;
  confidence: "explicit" | "inferred";
  count: number;
  updatedAt: string;
  source?: "chat" | "draft" | "workflow";
};

export type CreatorMemoryTag = {
  name: string;
  count: number;
  updatedAt: string;
};

export type CreatorProductMemory = {
  id: string;
  description: string;
  count: number;
  updatedAt: string;
};

export type CreatorMemoryProfile = {
  accountId: string;
  updatedAt: string;
  topics: CreatorMemoryTag[];
  tags: CreatorMemoryTag[];
  liked: CreatorMemoryItem[];
  disliked: CreatorMemoryItem[];
  tone: CreatorMemoryItem[];
  products: CreatorProductMemory[];
};

export type CreatorMemoryStore = {
  schemaVersion: 1;
  profiles: Record<string, CreatorMemoryProfile>;
};

export type CreatorMemoryTurnInput = {
  accountId: string;
  message: string;
  assistantAnswer?: string;
  currentDraft?: DraftRecord;
  workflowResult?: OneClickResult;
  attachedAssets?: unknown[];
  conversationId?: string | null;
};

export type CreatorMemoryDigest = {
  active: boolean;
  headline: string;
  detail: string;
  willUse: string[];
  willAvoid: string[];
  productHints: string[];
  tagHints: string[];
  projectHints: string[];
  signalCount: number;
};

type CreatorMemoryDigestInput = {
  liked?: Array<{ text: string }>;
  disliked?: Array<{ text: string }>;
  tone?: Array<{ text: string }>;
  products?: Array<{ description: string }>;
  tags?: Array<{ name: string }>;
};

const memoryPath = () => path.join(process.cwd(), "data", "creator-memory.json");

export async function readCreatorMemoryStore(): Promise<CreatorMemoryStore> {
  try {
    const raw = await readFile(memoryPath(), "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as Partial<CreatorMemoryStore>;
    return normalizeStore(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { schemaVersion: 1, profiles: {} };
    }
    throw error;
  }
}

export async function readCreatorMemoryProfile(accountId: string): Promise<CreatorMemoryProfile> {
  const store = await readCreatorMemoryStore();
  return store.profiles[accountId] ?? createEmptyProfile(accountId);
}

export async function writeCreatorMemoryProfile(profile: CreatorMemoryProfile): Promise<CreatorMemoryProfile> {
  const store = await readCreatorMemoryStore();
  const nextStore: CreatorMemoryStore = {
    schemaVersion: 1,
    profiles: {
      ...store.profiles,
      [profile.accountId]: normalizeProfile(profile.accountId, profile)
    }
  };
  await writeCreatorMemoryStore(nextStore);
  return nextStore.profiles[profile.accountId];
}

export async function updateCreatorMemoryFromTurn(input: CreatorMemoryTurnInput): Promise<CreatorMemoryProfile> {
  const profile = await readCreatorMemoryProfile(input.accountId);
  const now = new Date().toISOString();
  let next: CreatorMemoryProfile = { ...profile, updatedAt: now };
  const userText = normalizeText(input.message);

  for (const item of extractPreferenceItems(userText, "liked", now)) {
    next = { ...next, liked: upsertMemoryItem(next.liked, item) };
  }
  for (const item of extractPreferenceItems(userText, "disliked", now)) {
    next = { ...next, disliked: upsertMemoryItem(next.disliked, item) };
  }
  for (const item of extractToneItems(userText, now)) {
    next = { ...next, tone: upsertMemoryItem(next.tone, item) };
  }
  for (const product of extractProductDescriptions(userText, now)) {
    next = { ...next, products: upsertProduct(next.products, product) };
  }

  if (input.workflowResult?.draft?.title) {
    next = { ...next, topics: upsertTag(next.topics, input.workflowResult.draft.title, now) };
  }
  for (const sample of input.workflowResult?.evidence ?? []) {
    if (sample.title) {
      next = { ...next, topics: upsertTag(next.topics, sample.title.slice(0, 18), now) };
    }
  }
  for (const tag of input.currentDraft?.draft.tags ?? input.workflowResult?.draft?.tags ?? []) {
    next = { ...next, tags: upsertTag(next.tags, tag, now) };
  }
  if (input.currentDraft?.draft.title) {
    next = { ...next, topics: upsertTag(next.topics, input.currentDraft.draft.title.slice(0, 18), now) };
  }

  return writeCreatorMemoryProfile(trimProfile(next));
}

export function buildCreatorMemoryContext(profile?: CreatorMemoryProfile | null): string {
  if (!profile) {
    return "";
  }

  const sections = [
    formatMemoryItems("User stable likes", profile.liked),
    formatMemoryItems("User stable dislikes", profile.disliked),
    formatMemoryItems("Preferred tone/style", profile.tone),
    profile.products.length
      ? `Known products:\n${profile.products.slice(0, 5).map((item) => `- ${item.description}`).join("\n")}`
      : "",
    profile.tags.length
      ? `Common tags:\n${profile.tags.slice(0, 10).map((item) => `#${item.name}`).join(" ")}`
      : ""
  ].filter(Boolean);

  if (!sections.length) {
    return "";
  }

  return `Creator memory. Treat this as stable preference context, but the latest user message always wins.\n${sections.join("\n\n")}`;
}

export function buildCreatorMemoryDigest(
  profile?: CreatorMemoryDigestInput | null,
  projectMemory: string[] = []
): CreatorMemoryDigest {
  const projectHints = uniqueStrings(projectMemory).slice(0, 3);
  const willUse = uniqueStrings([
    ...projectHints,
    ...(profile?.liked ?? []).map((item) => item.text),
    ...(profile?.tone ?? []).map((item) => item.text)
  ]).slice(0, 5);
  const willAvoid = uniqueStrings((profile?.disliked ?? []).map((item) => item.text)).slice(0, 3);
  const productHints = uniqueStrings((profile?.products ?? []).map((item) => item.description)).slice(0, 3);
  const tagHints = uniqueStrings((profile?.tags ?? []).map((item) => `#${item.name}`)).slice(0, 6);
  const signalCount = willUse.length + willAvoid.length + productHints.length + tagHints.length;

  if (!signalCount) {
    return {
      active: false,
      headline: "等待沉淀创作记忆",
      detail: "当你明确表达喜欢、不喜欢、产品信息或常用标签时，Agent 会按当前小红书账号沉淀为长期偏好。",
      willUse: [],
      willAvoid: [],
      productHints: [],
      tagHints: [],
      projectHints,
      signalCount: 0
    };
  }

  return {
    active: true,
    headline: `本次会参考 ${signalCount} 条创作记忆`,
    detail: "这些记忆会作为稳定偏好进入 Agent 上下文，但当前 PostProject、实时证据和你的最新指令永远优先。",
    willUse,
    willAvoid,
    productHints,
    tagHints,
    projectHints,
    signalCount
  };
}

async function writeCreatorMemoryStore(store: CreatorMemoryStore): Promise<void> {
  const filePath = memoryPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(normalizeStore(store), null, 2)}\n`, "utf8");
}

function normalizeStore(value: Partial<CreatorMemoryStore>): CreatorMemoryStore {
  const profiles: Record<string, CreatorMemoryProfile> = {};
  if (value.profiles && typeof value.profiles === "object") {
    for (const [accountId, profile] of Object.entries(value.profiles)) {
      profiles[accountId] = normalizeProfile(accountId, profile);
    }
  }
  return { schemaVersion: 1, profiles };
}

function normalizeProfile(accountId: string, value: Partial<CreatorMemoryProfile> | undefined): CreatorMemoryProfile {
  const now = new Date().toISOString();
  return trimProfile({
    accountId,
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : now,
    topics: Array.isArray(value?.topics) ? value.topics.map(normalizeTag).filter(isPresent) : [],
    tags: Array.isArray(value?.tags) ? value.tags.map(normalizeTag).filter(isPresent) : [],
    liked: Array.isArray(value?.liked) ? value.liked.map((item) => normalizeItem(item, "liked")).filter(isPresent) : [],
    disliked: Array.isArray(value?.disliked)
      ? value.disliked.map((item) => normalizeItem(item, "disliked")).filter(isPresent)
      : [],
    tone: Array.isArray(value?.tone) ? value.tone.map((item) => normalizeItem(item, "tone")).filter(isPresent) : [],
    products: Array.isArray(value?.products) ? value.products.map(normalizeProduct).filter(isPresent) : []
  });
}

function createEmptyProfile(accountId: string): CreatorMemoryProfile {
  return {
    accountId,
    updatedAt: new Date().toISOString(),
    topics: [],
    tags: [],
    liked: [],
    disliked: [],
    tone: [],
    products: []
  };
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractPreferenceItems(
  text: string,
  kind: "liked" | "disliked",
  now: string
): CreatorMemoryItem[] {
  const pattern =
    kind === "liked"
      ? /(我喜欢|更喜欢|满意|以后.*用|保持|就要这种)([^。！？!?]{2,80})/g
      : /(不喜欢|不要再|避免|别再|太像广告|太营销|太夸张|这个不对)([^。！？!?]{2,80})/g;
  return [...text.matchAll(pattern)].map((match) => ({
    id: createStableId(`${kind}:${match[0]}`),
    text: truncateMemory(match[0]),
    confidence: "explicit",
    count: 1,
    updatedAt: now,
    source: "chat"
  }));
}

function extractToneItems(text: string, now: string): CreatorMemoryItem[] {
  const tonePattern = /(语气|口吻|风格|调性|表达).*?(真实|生活化|专业|干货|探店感|松弛|高级|不广告|不夸张|像真人)([^。！？!?]{0,60})/g;
  const directPattern = /(真实分享|生活化|不要像广告|专业干货|探店感|松弛感|高级质感)([^。！？!?]{0,60})/g;
  return [...text.matchAll(tonePattern), ...text.matchAll(directPattern)].map((match) => ({
    id: createStableId(`tone:${match[0]}`),
    text: truncateMemory(match[0]),
    confidence: "explicit",
    count: 1,
    updatedAt: now,
    source: "chat"
  }));
}

function extractProductDescriptions(text: string, now: string): CreatorProductMemory[] {
  const pattern = /(我的产品是|产品是|品牌是|我要宣传)([^。！？!?]{2,100})/g;
  return [...text.matchAll(pattern)].map((match) => ({
    id: createStableId(`product:${match[0]}`),
    description: truncateMemory(match[0]),
    count: 1,
    updatedAt: now
  }));
}

function upsertMemoryItem(items: CreatorMemoryItem[], next: CreatorMemoryItem): CreatorMemoryItem[] {
  const existing = items.find((item) => item.id === next.id || item.text === next.text);
  if (!existing) {
    return [next, ...items].slice(0, 30);
  }
  return [
    { ...existing, count: existing.count + 1, updatedAt: next.updatedAt, confidence: next.confidence },
    ...items.filter((item) => item !== existing)
  ].slice(0, 30);
}

function upsertTag(items: CreatorMemoryTag[], name: string, now: string): CreatorMemoryTag[] {
  const normalized = normalizeTagName(name);
  if (!normalized) {
    return items;
  }
  const existing = items.find((item) => item.name === normalized);
  if (!existing) {
    return [{ name: normalized, count: 1, updatedAt: now }, ...items].slice(0, 30);
  }
  return [{ ...existing, count: existing.count + 1, updatedAt: now }, ...items.filter((item) => item !== existing)].slice(0, 30);
}

function upsertProduct(items: CreatorProductMemory[], next: CreatorProductMemory): CreatorProductMemory[] {
  const existing = items.find((item) => item.id === next.id || item.description === next.description);
  if (!existing) {
    return [next, ...items].slice(0, 12);
  }
  return [{ ...existing, count: existing.count + 1, updatedAt: next.updatedAt }, ...items.filter((item) => item !== existing)].slice(0, 12);
}

function trimProfile(profile: CreatorMemoryProfile): CreatorMemoryProfile {
  return {
    ...profile,
    topics: profile.topics.slice(0, 30),
    tags: profile.tags.slice(0, 30),
    liked: profile.liked.slice(0, 30),
    disliked: profile.disliked.slice(0, 30),
    tone: profile.tone.slice(0, 30),
    products: profile.products.slice(0, 12)
  };
}

function formatMemoryItems(title: string, items: CreatorMemoryItem[]): string {
  if (!items.length) {
    return "";
  }
  return `${title}:\n${items.slice(0, 6).map((item) => `- ${item.text}`).join("\n")}`;
}

function normalizeTag(value: unknown): CreatorMemoryTag | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<CreatorMemoryTag>;
  const name = normalizeTagName(record.name);
  if (!name) {
    return null;
  }
  return {
    name,
    count: typeof record.count === "number" ? Math.max(1, record.count) : 1,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString()
  };
}

function normalizeItem(value: unknown, fallback: string): CreatorMemoryItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<CreatorMemoryItem>;
  if (!record.text?.trim()) {
    return null;
  }
  return {
    id: typeof record.id === "string" ? record.id : createStableId(`${fallback}:${record.text}`),
    text: truncateMemory(record.text),
    confidence: record.confidence === "inferred" ? "inferred" : "explicit",
    count: typeof record.count === "number" ? Math.max(1, record.count) : 1,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString(),
    source: record.source
  };
}

function normalizeProduct(value: unknown): CreatorProductMemory | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<CreatorProductMemory>;
  if (!record.description?.trim()) {
    return null;
  }
  return {
    id: typeof record.id === "string" ? record.id : createStableId(`product:${record.description}`),
    description: truncateMemory(record.description),
    count: typeof record.count === "number" ? Math.max(1, record.count) : 1,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString()
  };
}

function normalizeTagName(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/^#+/, "").replace(/\s+/g, "").slice(0, 24);
}

function truncateMemory(value: string): string {
  return normalizeText(value).slice(0, 120);
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const clean = normalizeText(value);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

function createStableId(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `memory-${hash.toString(36)}`;
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
