const baseUrl = (process.env.XHS_STUDIO_URL || "http://localhost:3000").replace(/\/+$/, "");

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function line(label, value) {
  console.log(`${label}: ${value}`);
}

function fail(message) {
  console.error(`Smoke check failed: ${message}`);
  process.exitCode = 1;
}

try {
  line("XHS Studio", baseUrl);

  const settings = await getJson("/api/settings");
  if (!settings.response.ok) {
    fail(`/api/settings returned HTTP ${settings.response.status}`);
  } else {
    line("Settings", settings.data.actionToken ? "ok, local action token available" : "missing action token");
    line("MCP URL", settings.data.mcpUrl || "not configured");
  }

  const health = await getJson("/api/health/mcp");
  if (!health.response.ok) {
    fail(`/api/health/mcp returned HTTP ${health.response.status}`);
  } else {
    line("MCP reachable", String(Boolean(health.data.reachable)));
    line("MCP logged in", String(Boolean(health.data.loggedIn)));
    line("MCP tools", Array.isArray(health.data.tools) ? String(health.data.tools.length) : "unknown");
    line(
      "Agent runnable tools",
      Array.isArray(health.data.agentTools)
        ? String(health.data.agentTools.filter((tool) => tool && tool.runnable).length)
        : "unknown"
    );
    if (!health.data.reachable) {
      fail("MCP is not reachable. Start it with: powershell -NoProfile -ExecutionPolicy Bypass -File .\\start-xhs.ps1");
    } else if (!health.data.loggedIn) {
      fail("MCP is reachable but not logged in. Run: .\\login-xhs.ps1");
    }
  }

  const project = await getJson("/api/post-project");
  if (!project.response.ok) {
    fail(`/api/post-project returned HTTP ${project.response.status}`);
  } else {
    line("PostProject", project.data.project?.id || "missing");
    line("PostProject stage", project.data.project?.currentStage || "unknown");
    line("Allowed actions", Array.isArray(project.data.project?.allowedActions) ? project.data.project.allowedActions.join(", ") : "unknown");
  }

  if (!process.exitCode) {
    console.log("Smoke check passed. No external publishing action was triggered.");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
