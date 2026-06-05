import type { PostProject } from "@/app/types";

type QualityCheck = NonNullable<PostProject["qualityCheck"]>;
type ViralCoverage = NonNullable<QualityCheck["viralCoverage"]>;

export type QualityViralCoverageView = {
  hasCoverage: boolean;
  headline: string;
  detail: string;
  items: Array<{
    field: ViralCoverage["fields"][number]["field"];
    label: string;
    status: "covered" | "missing";
    viralCount: number;
    weakViralCount?: number;
    realtimeCount: number;
    line: string;
  }>;
};

export function buildQualityViralCoverageView(
  coverage: QualityCheck["viralCoverage"] | undefined
): QualityViralCoverageView {
  if (!coverage) {
    return {
      hasCoverage: false,
      headline: "爆款库覆盖待检查",
      detail: "运行 Quality Gate 后，会显示标题、正文、标签和图片方向是否有爆款库规律支撑。",
      items: []
    };
  }

  const coveredCount = coverage.fields.filter((field) => field.status === "covered").length;
  const totalCount = coverage.fields.length || 4;
  const missingText = coverage.missingFields.length ? `缺少：${coverage.missingFields.join("、")}` : "四个创作字段都有爆款库证据";

  return {
    hasCoverage: true,
    headline: `爆款库覆盖 ${coveredCount}/${totalCount}`,
    detail: `${coverage.summary}；${missingText}`,
    items: coverage.fields.map((field) => {
      const viralCount = field.viralEvidenceIds.length;
      const weakViralCount = field.weakViralEvidenceIds?.length ?? 0;
      const realtimeCount = field.realtimeEvidenceIds.length;
      const weakLine = weakViralCount ? ` · 弱参考 ${weakViralCount} 条` : "";
      return {
        field: field.field,
        label: labelForQualityViralField(field.field),
        status: field.status,
        viralCount,
        weakViralCount,
        realtimeCount,
        line: field.status === "covered"
          ? `可用爆款 ${viralCount} 条 · 实时 ${realtimeCount} 条${weakLine}`
          : `缺可用爆款 · 实时 ${realtimeCount} 条${weakLine}`
      };
    })
  };
}

function labelForQualityViralField(field: ViralCoverage["fields"][number]["field"]): string {
  const labels: Record<ViralCoverage["fields"][number]["field"], string> = {
    title: "标题",
    content: "正文",
    tags: "标签",
    imagePrompt: "图片方向"
  };
  return labels[field];
}
