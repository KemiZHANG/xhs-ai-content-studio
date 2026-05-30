export function isExplicitXhsLoggedInStatus(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (isExplicitXhsLoggedOutStatus(normalized)) return false;
  return /已登录|已登陆|登录成功|登陆成功|logged\s+in|login\s+success|authenticated/i.test(normalized);
}

export function isExplicitXhsLoggedOutStatus(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  return /未登录|未登陆|没有登录|请先登录|需要登录|not\s+logged\s+in|not\s*login(?:ed)?|login\s+required|logged\s*out|unauthorized|forbidden/i.test(normalized);
}
