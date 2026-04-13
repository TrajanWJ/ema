const HARVEST_STATE_KEY = "emaHarvestState";

function loginUrlForSource(source) {
  if (source === "claude.ai") return "https://claude.ai/login";
  return "https://chatgpt.com/auth/login";
}

function sourcePattern(source) {
  if (source === "claude.ai") return "*://claude.ai/*";
  return ["*://chatgpt.com/*", "*://chat.openai.com/*"];
}

async function getHarvestState() {
  const stored = await chrome.storage.local.get({
    [HARVEST_STATE_KEY]: {
      status: "idle",
      source: null,
      accountLabel: null,
      imported: 0,
      total: 0,
      current: null,
      lastError: null,
      startedAt: null,
      finishedAt: null,
      results: [],
    },
  });
  return stored[HARVEST_STATE_KEY];
}

async function setHarvestState(patch) {
  const current = await getHarvestState();
  await chrome.storage.local.set({
    [HARVEST_STATE_KEY]: {
      ...current,
      ...patch,
    },
  });
}

async function findSourceTab(source) {
  const tabs = await chrome.tabs.query({ url: sourcePattern(source) });
  return tabs.find((tab) => typeof tab.id === "number") || null;
}

async function openLogin(source) {
  const loginUrl = loginUrlForSource(source);
  const tab = await chrome.tabs.create({ url: loginUrl, active: true });
  return {
    status: "needs_login",
    source,
    loginUrl,
    tabId: tab.id ?? null,
  };
}

async function sendTabMessage(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 15000);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status !== "complete") return;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text}`.trim());
  }
  return res.json();
}

async function importBundle(baseUrl, bundle, runExtract) {
  const imported = await postJson(`${baseUrl}/api/chronicle/import`, bundle);
  const sessionId = imported?.detail?.session?.id;
  if (!sessionId) {
    throw new Error("chronicle_import_missing_session_id");
  }

  if (runExtract) {
    await postJson(`${baseUrl}/api/chronicle/sessions/${encodeURIComponent(sessionId)}/extract`, {});
  }

  return {
    sessionId,
    title: imported?.detail?.session?.title ?? bundle?.session?.title ?? "Imported session",
  };
}

async function startHarvest(input) {
  const source = input?.source === "claude.ai" ? "claude.ai" : "chatgpt";
  const baseUrl = String(input?.baseUrl || "http://127.0.0.1:4488").replace(/\/$/, "");
  const accountLabel = typeof input?.accountLabel === "string" && input.accountLabel.trim().length > 0
    ? input.accountLabel.trim()
    : `${source}:default`;
  const runExtract = input?.runExtract !== false;
  const limit = typeof input?.limit === "number" && Number.isFinite(input.limit)
    ? Math.max(1, Math.min(5000, Math.floor(input.limit)))
    : 500;

  await setHarvestState({
    status: "starting",
    source,
    accountLabel,
    imported: 0,
    total: 0,
    current: null,
    lastError: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    results: [],
  });

  const seedTab = await findSourceTab(source);
  if (!seedTab?.id) {
    const loginState = await openLogin(source);
    await setHarvestState({
      status: "needs_login",
      lastError: "No authenticated source tab was open. Login page opened.",
    });
    return loginState;
  }

  const status = await sendTabMessage(seedTab.id, { type: "ema:getStatus" });
  if (!status?.ok || !status?.loggedIn) {
    const loginState = await openLogin(source);
    await setHarvestState({
      status: "needs_login",
      lastError: "Login required before harvesting can continue.",
    });
    return loginState;
  }

  const listed = await sendTabMessage(seedTab.id, { type: "ema:listConversations" });
  let conversations = Array.isArray(listed?.conversations) ? listed.conversations : [];
  if (conversations.length === 0 && typeof status.currentUrl === "string") {
    conversations = [{
      id: status.currentUrl,
      url: status.currentUrl,
      title: status.title || "Current conversation",
    }];
  }

  const selected = conversations.slice(0, limit);
  await setHarvestState({
    status: "running",
    total: selected.length,
    current: selected[0]?.title ?? null,
  });

  if (selected.length === 0) {
    await setHarvestState({
      status: "empty",
      finishedAt: new Date().toISOString(),
      lastError: "No harvestable conversations were discovered on the current source.",
    });
    return await getHarvestState();
  }

  const harvestTab = await chrome.tabs.create({ url: selected[0].url, active: false });
  const harvestTabId = harvestTab.id;
  if (typeof harvestTabId !== "number") {
    throw new Error("harvest_tab_unavailable");
  }

  const results = [];
  try {
    for (let index = 0; index < selected.length; index += 1) {
      const conversation = selected[index];
      await chrome.tabs.update(harvestTabId, { url: conversation.url });
      await waitForTabComplete(harvestTabId);
      await new Promise((resolve) => setTimeout(resolve, 900));

      const capture = await sendTabMessage(harvestTabId, {
        type: "ema:extractConversation",
        accountLabel,
      });
      if (!capture?.ok) {
        const message = capture?.error || "capture_failed";
        results.push({
          url: conversation.url,
          title: conversation.title,
          ok: false,
          error: message,
        });
        await setHarvestState({
          imported: results.filter((entry) => entry.ok).length,
          current: conversation.title,
          results,
          lastError: message,
        });
        continue;
      }

      const imported = await importBundle(baseUrl, capture.bundle, runExtract);
      results.push({
        url: conversation.url,
        title: imported.title,
        ok: true,
        sessionId: imported.sessionId,
      });

      await setHarvestState({
        imported: results.filter((entry) => entry.ok).length,
        current: conversation.title,
        results,
        lastError: null,
      });
    }
  } finally {
    await chrome.tabs.remove(harvestTabId).catch(() => {});
  }

  await setHarvestState({
    status: "completed",
    imported: results.filter((entry) => entry.ok).length,
    current: null,
    results,
    finishedAt: new Date().toISOString(),
  });

  return await getHarvestState();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return;

  if (message.type === "ema:getHarvestState") {
    getHarvestState().then(sendResponse).catch((error) => {
      sendResponse({ status: "error", detail: error instanceof Error ? error.message : "unknown_error" });
    });
    return true;
  }

  if (message.type === "ema:openLogin") {
    openLogin(message.source === "claude.ai" ? "claude.ai" : "chatgpt")
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ status: "error", detail: error instanceof Error ? error.message : "unknown_error" });
      });
    return true;
  }

  if (message.type === "ema:startHarvest") {
    startHarvest(message)
      .then(sendResponse)
      .catch(async (error) => {
        const detail = error instanceof Error ? error.message : "unknown_error";
        await setHarvestState({
          status: "failed",
          finishedAt: new Date().toISOString(),
          lastError: detail,
        });
        sendResponse({ status: "failed", detail });
      });
    return true;
  }
});
