import type { OneClickResult } from "@/lib/workflows/one-click";

type BriefResult = {
  researchSummary?: OneClickResult["researchSummary"];
  imageStyleReport?: string;
};

export function buildCopyCreativeBrief(result: BriefResult | null, userRequirement = ""): string {
  if (!result) {
    return withUserRequirement("还没有可用的研究结论。请先完成主题研究，再进入文案创作。", userRequirement);
  }

  const summary = result.researchSummary;
  const lines = [
    "文案创作简报：",
    formatSection("标题与选题应该学习", summary?.contentStrengths),
    formatSection("正文结构应该学习", summary?.learningsForContent),
    formatSection("标签与转化前需要补充", summary?.nextQuestions),
    "要求：生成全新的原创表达，不复述、不拼接、不照抄样本标题或正文。"
  ].filter(Boolean);

  return withUserRequirement(lines.join("\n"), userRequirement);
}

export function buildImageCreativeBrief(result: BriefResult | null, userRequirement = ""): string {
  if (!result) {
    return withUserRequirement("还没有可用的图片研究结论。可以只根据你的产品图和描述生成。", userRequirement);
  }

  const summary = result.researchSummary;
  const lines = [
    "图片创作简报：",
    formatSection("样本图片的优点", summary?.imageStrengths),
    formatSection("新图片应该学习", summary?.learningsForImages),
    result.imageStyleReport?.trim() ? `风格总结：${clamp(result.imageStyleReport.trim(), 900)}` : "",
    "要求：生成新的原创图片，不复制样本图片，不挪用样本图片素材。"
  ].filter(Boolean);

  return withUserRequirement(lines.join("\n"), userRequirement);
}

export function buildDraftPromptFromBrief(copyBrief: string): string {
  return `请基于下面的文案创作简报生成一篇原创小红书笔记，不要重新搜索。

${copyBrief}

请输出标题、正文、标签、正文结构和图片提示词。`;
}

function formatSection(label: string, values?: string[]): string {
  const list = compactList(values);
  return list.length ? `${label}：${list.join("；")}` : "";
}

function compactList(values?: string[]): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean).map((value) => clamp(value, 160));
}

function withUserRequirement(base: string, userRequirement: string): string {
  const requirement = userRequirement.trim();
  return requirement ? `${base}\n\n我的补充需求：${clamp(requirement, 800)}` : base;
}

function clamp(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
