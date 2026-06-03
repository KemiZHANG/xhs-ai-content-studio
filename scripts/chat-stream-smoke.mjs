const baseUrl = (process.env.XHS_STUDIO_URL || "http://localhost:3000").replace(/\/+$/, "");

async function requestJson(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers || {})
    },
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function line(label, value) {
  console.log(`${label}: ${value}`);
}

function fail(message) {
  console.error(`Chat stream smoke failed: ${message}`);
  process.exitCode = 1;
}

function parseSse(text) {
  return text
    .split(/\n\n+/)
    .map((chunk) => {
      const event = chunk.split(/\r?\n/).find((line) => line.startsWith("event:"))?.replace(/^event:\s*/, "").trim();
      const dataText = chunk
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.replace(/^data:\s*/, ""))
        .join("\n");
      if (!event || !dataText) return null;
      try {
        return { event, data: JSON.parse(dataText) };
      } catch {
        return { event, data: dataText };
      }
    })
    .filter(Boolean);
}

try {
  line("XHS Studio", baseUrl);

  const settings = await requestJson("/api/settings");
  const actionToken = settings.data?.actionToken;
  if (!settings.response.ok || !actionToken) {
    fail("cannot read local action token from /api/settings");
    process.exit();
  }

  const response = await fetch(`${baseUrl}/api/chat/stream`, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      "X-XHS-Action-Token": actionToken
    },
    body: JSON.stringify({ message: "" }),
    signal: AbortSignal.timeout(30000)
  });
  const text = await response.text();
  const events = parseSse(text);

  line("HTTP status", String(response.status));
  line("Content-Type", response.headers.get("content-type") || "missing");
  line("SSE events", events.map((item) => item.event).join(", ") || "none");

  if (!response.ok) fail(`/api/chat/stream returned HTTP ${response.status}`);
  if (!response.headers.get("content-type")?.includes("text/event-stream")) fail("chat stream did not return text/event-stream");
  if (!events.some((item) => item.event === "status")) fail("chat stream did not emit a status event");
  if (!events.some((item) => item.event === "error")) fail("chat stream did not emit an error event for empty input");
  if (!text.includes("请输入问题")) fail("empty-message stream should surface the validation error");
  if (text.includes("event: result")) fail("empty-message stream must not produce a successful Agent result");

  if (!process.exitCode) {
    console.log("Chat stream smoke passed. It validated SSE transport only; no model, MCP search, image generation, publish, or schedule action was triggered.");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
