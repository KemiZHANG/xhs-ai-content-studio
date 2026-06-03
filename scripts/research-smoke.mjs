const baseUrl = (process.env.XHS_STUDIO_URL || "http://localhost:3000").replace(/\/+$/, "");
const topic = process.env.XHS_SMOKE_TOPIC || "广州咖啡馆";
const sampleCount = Number(process.env.XHS_SMOKE_SAMPLE_COUNT || 1);

async function requestJson(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers || {})
    },
    signal: AbortSignal.timeout(180000)
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function line(label, value) {
  console.log(`${label}: ${value}`);
}

function fail(message) {
  console.error(`Research smoke failed: ${message}`);
  process.exitCode = 1;
}

function getEvidence(result) {
  if (Array.isArray(result?.evidence)) return result.evidence;
  if (Array.isArray(result?.samples)) return result.samples;
  return [];
}

try {
  line("XHS Studio", baseUrl);
  line("Topic", topic);

  const settings = await requestJson("/api/settings");
  const actionToken = settings.data?.actionToken;
  if (!settings.response.ok || !actionToken) {
    fail("cannot read local action token from /api/settings");
    process.exit();
  }

  const payload = {
    topic,
    contentType: "图文",
    timeRange: "一周内",
    sampleCount,
    workflowGoal: "research",
    publishMode: "draft",
    autoPublish: false,
    analyzeImages: false,
    generateImages: false,
    useViralKnowledge: false,
    retrievalLimit: sampleCount
  };

  const run = await requestJson("/api/workflows/one-click", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-XHS-Action-Token": actionToken
    },
    body: JSON.stringify(payload)
  });

  if (!run.response.ok) {
    fail(`/api/workflows/one-click returned HTTP ${run.response.status}: ${run.data?.error || "unknown error"}`);
    process.exit();
  }

  const result = run.data?.result;
  const evidence = getEvidence(result);
  const first = evidence[0] || {};
  const publishResult = result?.publishResult || {};

  line("Run", run.data?.run?.id || "unknown");
  line("Status", result?.status || "unknown");
  line("Evidence count", String(evidence.length));
  line("First title", first.title || "missing");
  line("First interactions", `likes=${first.likes ?? "?"}, collects=${first.collects ?? "?"}, comments=${first.comments ?? "?"}`);
  line("Publish skipped", `${String(Boolean(publishResult.skipped))} (${publishResult.reason || "no reason"})`);

  if (result?.status !== "research_ready") fail(`expected research_ready, got ${result?.status || "missing"}`);
  if (evidence.length < 1) fail("expected at least one evidence sample");
  if (result?.draft) fail("research smoke must not create a draft");
  if (Array.isArray(result?.images) && result.images.length > 0) fail("research smoke must not generate images");
  if (publishResult.skipped !== true || publishResult.reason !== "research mode") {
    fail("research smoke must skip publishing with reason: research mode");
  }

  if (!process.exitCode) {
    console.log("Research smoke passed. It searched/analyzed only; no draft, image generation, or external publishing action was triggered.");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
