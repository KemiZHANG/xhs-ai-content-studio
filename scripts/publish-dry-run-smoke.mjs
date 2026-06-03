const baseUrl = (process.env.XHS_STUDIO_URL || "http://localhost:3000").replace(/\/+$/, "");

async function requestJson(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers || {})
    },
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function line(label, value) {
  console.log(`${label}: ${value}`);
}

function fail(message) {
  console.error(`Publish dry-run smoke failed: ${message}`);
  process.exitCode = 1;
}

async function uploadTinyImage(actionToken) {
  const pngBytes = Uint8Array.from(Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64"
  ));
  const form = new FormData();
  form.append("file", new File([pngBytes], "publish-dry-run.png", { type: "image/png" }));
  const upload = await requestJson("/api/assets", {
    method: "POST",
    headers: {
      "X-XHS-Action-Token": actionToken
    },
    body: form
  });
  if (!upload.response.ok || !upload.data?.asset?.id) {
    throw new Error(`/api/assets returned HTTP ${upload.response.status}: ${upload.data?.error || "missing asset id"}`);
  }
  return upload.data.asset.id;
}

try {
  line("XHS Studio", baseUrl);

  const settings = await requestJson("/api/settings");
  const actionToken = settings.data?.actionToken;
  if (!settings.response.ok || !actionToken) {
    fail("cannot read local action token from /api/settings");
    process.exit();
  }

  const assetId = await uploadTinyImage(actionToken);
  line("Preview asset", assetId);

  const payload = {
    dryRun: true,
    title: "发布 dry-run 安全验证",
    content: "这是一条本地发布预览验证内容，用于确认系统只生成确认单和风险提示，不会调用真实小红书发布。",
    tags: ["发布验证", "安全检查"],
    assetIds: [assetId],
    visibility: "仅自己可见"
  };

  const preview = await requestJson("/api/publish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-XHS-Action-Token": actionToken
    },
    body: JSON.stringify(payload)
  });

  if (!preview.response.ok) {
    fail(`/api/publish dry-run returned HTTP ${preview.response.status}: ${preview.data?.error || "unknown error"}`);
    process.exit();
  }

  line("Status", preview.data?.status || "missing");
  line("Dry run", String(Boolean(preview.data?.dryRun)));
  line("Requires confirmation", String(Boolean(preview.data?.preview?.requiresConfirmation)));
  line("Visibility", preview.data?.preview?.visibility || "missing");
  line("Publish intent status", preview.data?.publishIntent?.status || "missing");
  line("Validation errors", Array.isArray(preview.data?.preview?.validationErrors) ? String(preview.data.preview.validationErrors.length) : "unknown");

  if (preview.data?.status !== "preview") fail("expected dry-run status to be preview");
  if (preview.data?.dryRun !== true) fail("expected dryRun true");
  if (preview.data?.preview?.requiresConfirmation !== true) fail("dry-run preview must require confirmation");
  if (preview.data?.preview?.visibility !== "仅自己可见") fail("dry-run preview must keep conservative visibility");
  if (["published", "scheduled"].includes(String(preview.data?.status))) fail("dry-run must not publish or schedule");
  if (["published", "scheduled"].includes(String(preview.data?.publishIntent?.status))) fail("dry-run publishIntent must not be published or scheduled");

  if (!process.exitCode) {
    console.log("Publish dry-run smoke passed. It created a preview only; no external publishing action was triggered.");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
