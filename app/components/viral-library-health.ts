import type { ViralCase } from "@/app/types";

export type ViralLibraryHealthModel = {
  status: "empty" | "warn" | "ready";
  headline: string;
  detail: string;
  stats: Array<{
    label: string;
    value: string;
    tone: "neutral" | "good" | "warn";
  }>;
  warnings: string[];
  recommendations: string[];
};

export function buildViralLibraryHealth(cases: ViralCase[]): ViralLibraryHealthModel {
  if (!cases.length) {
    return {
      status: "empty",
      headline: "爆款库还没有长期样本",
      detail: "先从真实研究结果里沉淀高质量样本，系统会保存结构化规律，而不是保存原文合集。",
      stats: [
        { label: "样本", value: "0", tone: "neutral" },
        { label: "AI 提炼", value: "0%", tone: "neutral" },
        { label: "平均质量", value: "-", tone: "neutral" }
      ],
      warnings: [],
      recommendations: ["先完成一次主题研究，并保存互动和正文证据更完整的样本。"]
    };
  }

  const weakReferenceCount = cases.filter(isWeakReferenceCase).length;
  const usableCases = cases.filter((item) => !isWeakReferenceCase(item));
  const modelExtracted = usableCases.filter((item) => item.extraction?.method === "model").length;
  const withSafety = usableCases.filter((item) => item.creativeSafety?.reusablePatterns?.length || item.creativeSafety?.doNotCopy?.length).length;
  const qualityScores = usableCases.map((item) => item.quality?.score).filter((score): score is number => Number.isFinite(score));
  const averageQuality = qualityScores.length
    ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length
    : 0;
  const lowQualityCount = usableCases.filter((item) => (item.quality?.score ?? 0) < 0.55).length;
  const reusableRuleCount = usableCases.reduce((sum, item) => sum + (item.extractedInsights?.reusableRules?.length ?? 0), 0);
  const modelRatio = usableCases.length ? modelExtracted / usableCases.length : 0;
  const safetyRatio = usableCases.length ? withSafety / usableCases.length : 0;
  const warnings = [
    weakReferenceCount ? `${weakReferenceCount} 条样本是弱参考，仅能补充参考，不能计入可发布创作依据。` : "",
    !usableCases.length ? "当前没有可用高质量爆款样本，RAG 只能作为低置信补充。" : "",
    modelRatio < 0.5 ? "AI 提炼比例偏低，部分样本仍依赖本地启发式规则。" : "",
    averageQuality < 0.6 ? "结构化规律平均质量偏低，生成时需要更多人工复核。" : "",
    safetyRatio < 0.8 ? "部分样本缺少明确的原创边界和禁止复制规则。" : "",
    lowQualityCount ? `${lowQualityCount} 条样本质量分低于 55%，不建议作为核心创作依据。` : ""
  ].filter(Boolean);
  const recommendations = [
    usableCases.length < 8 ? "继续沉淀不同主题、不同钩子和不同图片风格的样本，避免知识库角度单一。" : "",
    weakReferenceCount ? "优先补充互动、正文、评论和图片证据更完整的高质量样本，替换弱参考样本。" : "",
    modelRatio < 0.5 ? "配置文本模型后重新保存关键样本，让入库内容优先由 AI 提取结构化规律。" : "",
    safetyRatio < 0.8 ? "保存样本时优先保留“可学什么 / 必须改写什么 / 不可复制什么”。" : "",
    reusableRuleCount < usableCases.length * 3 ? "优先补充标题钩子、正文结构、标签组合、图片风格和评论关注点。" : ""
  ].filter(Boolean);

  const status = warnings.length ? "warn" : "ready";

  return {
    status,
    headline: status === "ready" ? "爆款库质量可用于策略创作" : "爆款库还需要补强",
    detail: status === "ready"
      ? "当前样本已具备较稳定的结构化规律、原创边界和可追溯来源，可参与 CreativeBrief、文案和图片方向生成。"
      : "当前爆款库可以参与 RAG，但建议继续补样本和提升 AI 提炼比例，避免生成依据偏薄或角度单一。",
    stats: [
      { label: "样本", value: String(cases.length), tone: cases.length >= 8 ? "good" : "warn" },
      { label: "可用样本", value: String(usableCases.length), tone: usableCases.length >= 8 ? "good" : "warn" },
      { label: "弱参考", value: String(weakReferenceCount), tone: weakReferenceCount ? "warn" : "good" },
      { label: "AI 提炼", value: `${Math.round(modelRatio * 100)}%`, tone: modelRatio >= 0.5 ? "good" : "warn" },
      { label: "平均质量", value: `${Math.round(averageQuality * 100)}%`, tone: averageQuality >= 0.6 ? "good" : "warn" },
      { label: "原创边界", value: `${Math.round(safetyRatio * 100)}%`, tone: safetyRatio >= 0.8 ? "good" : "warn" }
    ],
    warnings: warnings.slice(0, 4),
    recommendations: recommendations.slice(0, 4)
  };
}

function isWeakReferenceCase(item: ViralCase): boolean {
  return item.quality?.warnings?.some((warning) => warning.includes("低质量样本被人工强制入库")) ?? false;
}
