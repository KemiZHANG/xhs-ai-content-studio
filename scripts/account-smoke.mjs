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
  console.error(`Account smoke check failed: ${message}`);
  process.exitCode = 1;
}

function accountLabel(account) {
  if (!account) return "missing";
  return `${account.displayName || account.id || "unnamed"} (${account.id || "no-id"})`;
}

try {
  line("XHS Studio", baseUrl);

  const settings = await getJson("/api/settings");
  if (!settings.response.ok) {
    fail(`/api/settings returned HTTP ${settings.response.status}`);
    process.exit();
  }

  const accounts = Array.isArray(settings.data?.accounts) ? settings.data.accounts : [];
  const activeAccountId = settings.data?.activeAccountId;
  const activeFromSettings = accounts.find((account) => account?.id === activeAccountId) || accounts[0];
  line("Configured accounts", String(accounts.length));
  line("Active account id", activeAccountId || "missing");
  line("Active account", accountLabel(activeFromSettings));
  line("Active MCP URL", activeFromSettings?.mcpUrl || settings.data?.mcpUrl || "missing");
  line("Publish policy", settings.data?.agentPublishPolicy || "missing");
  line("Default visibility", settings.data?.defaultVisibility || "missing");

  if (!settings.data?.actionToken) fail("local action token is missing");
  if (!accounts.length) fail("no Xiaohongshu account profile is configured");
  if (!activeAccountId) fail("activeAccountId is missing");
  if (!activeFromSettings) fail("active account id does not match any configured profile");
  if (!activeFromSettings?.mcpUrl && !settings.data?.mcpUrl) fail("active account MCP URL is missing");

  const health = await getJson("/api/health/mcp");
  if (!health.response.ok) {
    fail(`/api/health/mcp returned HTTP ${health.response.status}`);
    process.exit();
  }

  const healthAccount = health.data?.activeAccount;
  line("Health reachable", String(Boolean(health.data?.reachable)));
  line("Health logged in", String(Boolean(health.data?.loggedIn)));
  line("Health active account", accountLabel(healthAccount));
  line("Health login name", healthAccount?.loginName || "not reported");
  line("Agent tools", Array.isArray(health.data?.agentTools) ? String(health.data.agentTools.length) : "unknown");

  if (!healthAccount) fail("/api/health/mcp did not return activeAccount");
  if (healthAccount?.id && activeAccountId && healthAccount.id !== activeAccountId) {
    fail("health active account does not match settings activeAccountId");
  }
  if (!health.data?.reachable) fail("MCP is not reachable for the active account");
  if (!health.data?.loggedIn) fail("active account MCP is reachable but not logged in");

  if (accounts.length < 2) {
    console.log(
      "Multi-account note: only one account profile is configured. Add more MCP profiles on separate ports to test real switching."
    );
  }

  if (!process.exitCode) {
    console.log("Account smoke check passed. No search, image generation, publish, or schedule action was triggered.");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
