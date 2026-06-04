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

function futureScheduleAt() {
  return new Date(Date.now() + 90 * 60 * 1000).toISOString();
}

function viralSmokeSample() {
  return {
    id: "internal-viral-smoke-note",
    title: "周末咖啡馆先收藏这家",
    author: "smoke",
    likes: 1800,
    collects: 1200,
    comments: 88,
    shares: 26,
    score: 3600,
    url: "https://www.xiaohongshu.com/explore/internal-viral-smoke",
    imageUrls: ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"],
    cachedImageUrls: [],
    detailText: "这家店适合周末下午想安静坐一会儿的人。先说适合谁，再讲环境、座位、点单和避坑提醒，最后补充交通和人均。适合聊天、短时办公或一个人放空。",
    commentSnippets: ["想知道周末几点人少", "人均多少", "适合办公吗"],
    reasonHighlights: ["收藏高", "评论关注人均和时间"]
  };
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

  const viralPreview = await requestJson("/api/viral-knowledge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-XHS-Action-Token": actionToken
    },
    body: JSON.stringify({
      dryRun: true,
      useModel: false,
      topic: "广州咖啡馆",
      category: "探店",
      sample: viralSmokeSample()
    })
  });
  if (!viralPreview.response.ok) {
    fail(`/api/viral-knowledge dry-run returned HTTP ${viralPreview.response.status}: ${viralPreview.data?.error || "unknown error"}`);
    process.exit();
  }
  const viralCase = viralPreview.data?.case;
  if (viralPreview.data?.dryRun !== true) fail("viral knowledge extraction must be a dry-run preview");
  if (viralPreview.data?.project) fail("viral dry-run must not merge knowledge into the current PostProject");
  if (viralCase?.sourceSampleId !== "internal-viral-smoke-note") fail("viral dry-run must preserve the source sample id");
  if (viralPreview.data?.candidateReviews?.[0]?.shouldSave !== true) fail("viral dry-run sample must pass the save-quality review");
  if (!viralCase?.hookType || !viralCase?.imageStyle || !viralCase?.painPoint || !viralCase?.audience) {
    fail("viral dry-run must return structured creative fields");
  }
  if (!viralCase?.extractedInsights?.titleHooks?.length || !viralCase?.extractedInsights?.copyStructures?.length || !viralCase?.extractedInsights?.visualPatterns?.length) {
    fail("viral dry-run must extract reusable title, copy, and visual patterns");
  }
  if (!viralCase?.creativeSafety?.doNotCopy?.length) fail("viral dry-run must include originality boundaries");
  line("Viral Knowledge dry-run", viralCase.id || "missing");

  const assetId = await uploadTinyImage(actionToken);
  const qualityGate = await requestJson("/api/post-project", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-XHS-Action-Token": actionToken
    },
    body: JSON.stringify({
      action: "run_quality_gate",
      dryRun: true,
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
  if (qualityGate.data?.dryRun !== true) fail("run_quality_gate should be a dry-run preview");
  if (qualityGate.data?.project?.currentStage !== "reviewing") fail("run_quality_gate should move PostProject to reviewing");
  if (!qualityGate.data?.project?.finalPost) fail("run_quality_gate should create finalPost");
  if (!qualityGate.data?.project?.qualityCheck) fail("run_quality_gate should create qualityCheck");
  if (!qualityGate.data?.readiness?.items?.some((item) => item.id === "quality")) fail("readiness should include quality gate");
  line("Quality Gate preview", qualityGate.data.project.qualityCheck.canPublish ? "passed" : "checked");

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

  const scheduleAt = futureScheduleAt();
  const scheduledPreview = await requestJson("/api/publish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-XHS-Action-Token": actionToken
    },
    body: JSON.stringify({
      dryRun: true,
      title: "内部交付定时 smoke",
      content: "验证 Post Studio 可以生成定时发布确认预览，但不会创建真实小红书定时任务。",
      tags: ["内部验收", "定时发布"],
      assetIds: [assetId],
      visibility: "仅自己可见",
      scheduleAt
    })
  });
  if (!scheduledPreview.response.ok) {
    fail(`/api/publish scheduled dry-run returned HTTP ${scheduledPreview.response.status}: ${scheduledPreview.data?.error || "unknown error"}`);
    process.exit();
  }
  if (scheduledPreview.data?.status !== "preview" || scheduledPreview.data?.dryRun !== true) fail("scheduled dry-run must return preview");
  if (scheduledPreview.data?.preview?.requiresConfirmation !== true) fail("scheduled preview must require manual confirmation");
  if (scheduledPreview.data?.preview?.scheduleAt !== scheduleAt) fail("scheduled preview must echo the requested future time");
  if (["published", "scheduled"].includes(String(scheduledPreview.data?.publishIntent?.status))) {
    fail("scheduled dry-run publishIntent must not be published or scheduled");
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
    console.log("Internal delivery smoke passed. It checked PostProject readiness, viral knowledge dry-run, canvas Quality Gate dry-run, publish preview, scheduled publish preview, and acceptance status; no MCP search, model generation, external publish, schedule action, knowledge-base write, or current project overwrite was triggered.");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
