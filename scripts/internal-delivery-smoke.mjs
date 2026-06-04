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
  console.error(`Internal delivery smoke failed: ${message}`);
  process.exitCode = 1;
}

async function uploadTinyImage(actionToken) {
  const pngBytes = Uint8Array.from(Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64"
  ));
  const form = new FormData();
  form.append("file", new File([pngBytes], "internal-delivery.png", { type: "image/png" }));
  const upload = await requestJson("/api/assets", {
    method: "POST",
    headers: { "X-XHS-Action-Token": actionToken },
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

  const projectState = await requestJson("/api/post-project");
  if (!projectState.response.ok || !projectState.data?.project || !projectState.data?.readiness) {
    fail("/api/post-project must expose project and readiness");
    process.exit();
  }

  const project = projectState.data.project;
  const readiness = projectState.data.readiness;
  line("Project", project.id || "missing");
  line("Stage", project.currentStage || "missing");
  line("Readiness", `${readiness.progress ?? "missing"}%`);

  if (!Array.isArray(project.allowedActions)) fail("PostProject allowedActions missing");
  if (!Array.isArray(project.evidencePack?.insights)) fail("PostProject evidencePack insights missing");
  if (!Array.isArray(readiness.items) || !readiness.items.some((item) => item.id === "confirmation")) {
    fail("readiness must include confirmation gate");
  }

  const assetId = await uploadTinyImage(actionToken);
  const qualityGate = await requestJson("/api/post-project", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-XHS-Action-Token": actionToken
    },
    body: JSON.stringify({
      action: "run_quality_gate",
      selectedImageIds: [assetId],
      visibility: "仅自己可见",
      draft: {
        title: "内部交付闭环 smoke",
        content: "验证 Post Studio 可以把画布草稿、选中图片和发布检查写入同一个 PostProject。",
        tags: ["内部验收", "PostStudio"],
        structure: ["目标", "证据", "确认"],
        imagePrompt: "1px placeholder image for internal delivery smoke",
        basedOnEvidenceIds: ["internal-delivery-smoke"]
      }
    })
  });
  if (!qualityGate.response.ok) {
    fail(`/api/post-project run_quality_gate returned HTTP ${qualityGate.response.status}: ${qualityGate.data?.error || "unknown error"}`);
    process.exit();
  }
  if (qualityGate.data?.project?.currentStage !== "reviewing") fail("run_quality_gate should move PostProject to reviewing");
  if (!qualityGate.data?.project?.finalPost) fail("run_quality_gate should create finalPost");
  if (!qualityGate.data?.project?.qualityCheck) fail("run_quality_gate should create qualityCheck");
  if (!qualityGate.data?.readiness?.items?.some((item) => item.id === "quality")) fail("readiness should include quality gate");
  line("Quality Gate", qualityGate.data.project.qualityCheck.canPublish ? "passed" : "checked");

  const preview = await requestJson("/api/publish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-XHS-Action-Token": actionToken
    },
    body: JSON.stringify({
      dryRun: true,
      title: "内部交付闭环 smoke",
      content: "验证 Post Studio 内部闭环可以生成发布确认预览，但不会触发真实小红书发布。",
      tags: ["内部验收", "发布确认"],
      assetIds: [assetId],
      visibility: "仅自己可见"
    })
  });
  if (!preview.response.ok) {
    fail(`/api/publish dry-run returned HTTP ${preview.response.status}: ${preview.data?.error || "unknown error"}`);
    process.exit();
  }
  if (preview.data?.status !== "preview" || preview.data?.dryRun !== true) fail("publish dry-run must return preview");
  if (preview.data?.preview?.requiresConfirmation !== true) fail("publish preview must require manual confirmation");
  if (preview.data?.preview?.visibility !== "仅自己可见") fail("publish preview must keep private visibility");
  if (["published", "scheduled"].includes(String(preview.data?.publishIntent?.status))) {
    fail("internal delivery smoke must not publish or schedule");
  }

  const acceptance = await requestJson("/api/acceptance/status");
  const delivery = acceptance.data?.deliverySummary;
  if (!acceptance.response.ok || acceptance.data?.status?.roughDeliveryReady !== true) {
    fail("/api/acceptance/status must mark the internal loop as rough-delivery ready");
  }
  if (delivery?.stateLabel !== "内部闭环可交付") {
    fail("delivery summary must separate internal delivery from external gates");
  }

  if (!process.exitCode) {
    console.log("Internal delivery smoke passed. It checked PostProject readiness, canvas Quality Gate, publish preview, and acceptance status; no MCP search, model generation, external publish, or schedule action was triggered.");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
