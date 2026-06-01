export function resolvePostStudioTitle({
  projectTopic,
  workspaceTopic
}: {
  projectTopic?: string | null;
  workspaceTopic?: string | null;
}): string {
  return firstNonEmpty([projectTopic, workspaceTopic]) ?? "新帖子项目";
}

export function resolvePostCreationTopic({
  projectTopic,
  workspaceTopic,
  researchTopic
}: {
  projectTopic?: string | null;
  workspaceTopic?: string | null;
  researchTopic?: string | null;
}): string {
  return firstNonEmpty([projectTopic, workspaceTopic, researchTopic]) ?? "未命名帖子项目";
}

function firstNonEmpty(values: Array<string | null | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find((value): value is string => Boolean(value));
}
