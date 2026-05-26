"use client";

let clientActionToken = "";

type ApiOptions = {
  retriedActionToken?: boolean;
};

export function setClientActionToken(token: string | undefined): void {
  clientActionToken = token ?? "";
}

export function getClientActionToken(): string {
  return clientActionToken;
}

export async function clientApi<T = unknown>(
  path: string,
  init?: RequestInit,
  options: ApiOptions = {}
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (clientActionToken && !headers.has("X-XHS-Action-Token")) {
    headers.set("X-XHS-Action-Token", clientActionToken);
  }

  const response = await fetch(path, {
    ...init,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (
    response.status === 403 &&
    !options.retriedActionToken &&
    typeof data.error === "string" &&
    data.error.includes("令牌") &&
    (await refreshActionToken())
  ) {
    return clientApi(path, init, { retriedActionToken: true });
  }
  if (!response.ok) {
    throw new Error(data.error ?? "请求失败");
  }

  return data as T;
}

export async function clientFormDataApi<T = unknown>(
  path: string,
  form: FormData,
  init?: Omit<RequestInit, "body" | "method">
): Promise<T> {
  return clientApi<T>(path, {
    ...init,
    method: "POST",
    body: form
  });
}

async function refreshActionToken(): Promise<boolean> {
  const response = await fetch("/api/settings", {
    headers: {
      Accept: "application/json"
    }
  });
  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as { actionToken?: string };
  if (!data.actionToken) {
    return false;
  }
  setClientActionToken(data.actionToken);
  return true;
}
