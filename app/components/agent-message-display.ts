export type AgentMessageDisplay = {
  visibleText: string;
  fullText: string;
  truncated: boolean;
};

export function buildAgentMessageDisplay(
  content: string,
  options: { maxChars?: number; maxLines?: number } = {}
): AgentMessageDisplay {
  const fullText = content.trim();
  const maxChars = Math.max(80, options.maxChars ?? 420);
  const maxLines = Math.max(2, options.maxLines ?? 8);
  if (!fullText) {
    return { visibleText: "", fullText: "", truncated: false };
  }

  const lines = fullText.split(/\r?\n/);
  const lineLimited = lines.length > maxLines
    ? lines.slice(0, maxLines).join("\n")
    : fullText;
  const shouldLimitByLine = lines.length > maxLines;
  const candidate = lineLimited.length > maxChars
    ? trimAtReadableBoundary(lineLimited, maxChars)
    : lineLimited;
  const truncated = shouldLimitByLine || candidate.length < fullText.length;

  return {
    visibleText: truncated ? `${candidate.replace(/[。\s,，;；:：]+$/, "")}...` : fullText,
    fullText,
    truncated
  };
}

function trimAtReadableBoundary(value: string, maxChars: number): string {
  const clipped = value.slice(0, maxChars);
  const boundary = Math.max(
    clipped.lastIndexOf("\n"),
    clipped.lastIndexOf("。"),
    clipped.lastIndexOf("；"),
    clipped.lastIndexOf(";"),
    clipped.lastIndexOf("，"),
    clipped.lastIndexOf(","),
    clipped.lastIndexOf(" ")
  );
  if (boundary >= Math.floor(maxChars * 0.58)) {
    return clipped.slice(0, boundary);
  }
  return clipped;
}
