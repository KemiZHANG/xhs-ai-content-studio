export type ImageStudioPromptInput = {
  productName?: string;
  sellingPoints?: string;
  scene?: string;
  style?: string;
  extraPrompt?: string;
  evidenceContext?: string;
  hasSourceImages?: boolean;
};

export function buildImageStudioPrompt(input: ImageStudioPromptInput): string {
  const productName = input.productName?.trim() || "未指定产品";
  const sellingPoints = input.sellingPoints?.trim() || "请根据用户需求做真实、克制的小红书表达";
  const scene = input.scene?.trim() || "真实生活场景";
  const style = input.style?.trim() || "小红书真实分享风";
  const extraPrompt = input.extraPrompt?.trim() || "生成适合作为小红书图文笔记的原创配图";
  const evidenceContext = input.evidenceContext?.trim() || "暂无研究证据，请只根据用户描述生成，不要虚构竞品数据。";
  const sourceMode = input.hasSourceImages
    ? "已提供参考图/产品图：保留产品主体或学习参考图的构图、色调、光线，但不要复制原图。"
    : "可无参考图：根据文字需求直接生成原创画面。";

  return `为小红书图文笔记生成原创图片。

产品/对象：${productName}
卖点/要点：${sellingPoints}
目标场景：${scene}
视觉风格：${style}
补充要求：${extraPrompt}

研究证据上下文：
${evidenceContext}

参考图策略：
${sourceMode}

生成要求：
1. 图片必须服务于小红书发布，真实、自然、有生活使用场景。
2. 可以学习研究样本的优点，例如构图、光线、色调、信息密度、封面吸引力，但不要复制样本图、不要搬运原图元素。
3. 如果有产品图，保留产品主体、包装轮廓、颜色、材质和标签位置，不要凭空生成错误品牌文字。
4. 不要生成虚假认证、虚假 logo、夸大功效、医疗承诺或误导性文案。
5. 构图要适合手机竖图浏览，主体清晰，首图要有停留感，细节图要有真实使用感。`;
}

export function buildEvidenceContextForImageStudio(input: {
  report?: string;
  imageStyleReport?: string;
  contentStrengths?: string[];
  imageStrengths?: string[];
  learningsForImages?: string[];
}): string {
  return [
    input.report ? `研究报告：${input.report}` : "",
    input.imageStyleReport ? `图片风格分析：${input.imageStyleReport}` : "",
    input.contentStrengths?.length ? `内容优点：${input.contentStrengths.join("；")}` : "",
    input.imageStrengths?.length ? `图片优点：${input.imageStrengths.join("；")}` : "",
    input.learningsForImages?.length ? `图片生成应学习：${input.learningsForImages.join("；")}` : ""
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 6000);
}
