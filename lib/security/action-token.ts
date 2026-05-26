import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const ACTION_TOKEN_HEADER = "x-xhs-action-token";

type TokenFile = {
  token: string;
  createdAt: string;
};

const tokenFilePath = () => path.join(process.cwd(), "data", "local-action-token.json");

export async function attachActionToken<T extends object>(payload: T): Promise<T & { actionToken: string }> {
  return {
    ...payload,
    actionToken: await getLocalActionToken()
  };
}

export async function requireLocalActionToken(request: Request): Promise<NextResponse | null> {
  if (await verifyLocalActionToken(request)) {
    return null;
  }

  return NextResponse.json(
    {
      error: "缺少本地操作令牌，请刷新页面后重试。"
    },
    { status: 403 }
  );
}

export async function verifyLocalActionToken(request: Request): Promise<boolean> {
  const provided = request.headers.get(ACTION_TOKEN_HEADER);
  if (!provided) {
    return false;
  }

  const expected = await getLocalActionToken();
  return safeEqual(provided, expected);
}

export async function getLocalActionToken(): Promise<string> {
  const existing = await readTokenFile();
  if (existing?.token) {
    return existing.token;
  }

  const token = randomBytes(32).toString("base64url");
  await writeTokenFile({
    token,
    createdAt: new Date().toISOString()
  });
  return token;
}

async function readTokenFile(): Promise<TokenFile | null> {
  try {
    const raw = await readFile(tokenFilePath(), "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as Partial<TokenFile>;
    return typeof parsed.token === "string" && parsed.token ? (parsed as TokenFile) : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeTokenFile(file: TokenFile): Promise<void> {
  const filePath = tokenFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
