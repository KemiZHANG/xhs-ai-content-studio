export type CreatorMemoryDigestInput = {
  liked?: Array<{ text: string }>;
  disliked?: Array<{ text: string }>;
  tone?: Array<{ text: string }>;
  products?: Array<{ description: string }>;
  tags?: Array<{ name: string }>;
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

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
