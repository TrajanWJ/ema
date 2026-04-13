const emaUrlInput = document.getElementById("ema-url");
const runExtractInput = document.getElementById("run-extract");
const accountSourceSelect = document.getElementById("account-source");
const accountSelect = document.getElementById("account-select");
const accountLabelInput = document.getElementById("account-label");
const harvestLimitInput = document.getElementById("harvest-limit");
const sourceMetaEl = document.getElementById("source-meta");
const previewMetaEl = document.getElementById("preview-meta");
const harvestMetaEl = document.getElementById("harvest-meta");
const statusEl = document.getElementById("status");
const saveAccountButton = document.getElementById("save-account");
const openLoginButton = document.getElementById("open-login");
const refreshButton = document.getElementById("refresh");
const downloadButton = document.getElementById("download");
const sendButton = document.getElementById("send");
const harvestButton = document.getElementById("harvest");

let latestCapture = null;
let latestStatus = null;

function setBusy(isBusy) {
  [
    saveAccountButton,
    openLoginButton,
    refreshButton,
    downloadButton,
    sendButton,
    harvestButton,
  ].forEach((button) => {
    button.disabled = isBusy;
  });
}

function setStatus(message, isError = false) {
  statusEl.textContent = message || "";
  statusEl.classList.toggle("error", Boolean(isError));
}

async function storageDefaults() {
  return chrome.storage.local.get({
    emaUrl: "http://127.0.0.1:4488",
    runExtract: true,
    accounts: [],
    selectedAccountId: "",
    harvestLimit: 500,
  });
}

function activeSource() {
  return latestStatus?.platform === "claude.ai" ? "claude.ai" : "chatgpt";
}

async function saveSettings() {
  await chrome.storage.local.set({
    emaUrl: emaUrlInput.value.trim(),
    runExtract: runExtractInput.checked,
    selectedAccountId: accountSelect.value,
    harvestLimit: Number(harvestLimitInput.value) || 500,
  });
}

async function loadSettings() {
  const saved = await storageDefaults();
  emaUrlInput.value = saved.emaUrl;
  runExtractInput.checked = Boolean(saved.runExtract);
  harvestLimitInput.value = String(saved.harvestLimit || 500);
  accountSourceSelect.value = activeSource();
  await renderAccounts(saved.accounts || [], saved.selectedAccountId || "");
}

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function renderAccounts(accountsParam, selectedId) {
  const accounts = accountsParam || (await storageDefaults()).accounts || [];
  const source = accountSourceSelect.value || activeSource();
  const filtered = accounts.filter((account) => account.source === source);
  accountSelect.innerHTML = "";

  const fallback = document.createElement("option");
  fallback.value = "";
  fallback.textContent = `${source} default`;
  accountSelect.appendChild(fallback);

  filtered.forEach((account) => {
    const option = document.createElement("option");
    option.value = account.id;
    option.textContent = account.label;
    accountSelect.appendChild(option);
  });

  if (selectedId && filtered.some((account) => account.id === selectedId)) {
    accountSelect.value = selectedId;
  } else {
    accountSelect.value = "";
  }
}

async function selectedAccountLabel() {
  const saved = await storageDefaults();
  const source = accountSourceSelect.value || activeSource();
  const selected = (saved.accounts || []).find((account) => account.id === accountSelect.value);
  if (selected) return selected.label;
  return `${source}:default`;
}

async function refreshStatus() {
  const tab = await activeTab();
  if (!tab?.id) {
    latestStatus = null;
    sourceMetaEl.textContent = "No active tab.";
    return null;
  }

  try {
    latestStatus = await chrome.tabs.sendMessage(tab.id, { type: "ema:getStatus" });
  } catch {
    latestStatus = null;
  }

  if (!latestStatus?.ok) {
    sourceMetaEl.textContent = "Open ChatGPT or Claude in a tab to capture or harvest.";
    return null;
  }

  accountSourceSelect.value = activeSource();
  sourceMetaEl.textContent = `${latestStatus.platform} · ${latestStatus.loggedIn ? "logged in" : "login required"} · ${latestStatus.currentConversationId || "no conversation id"}`;
  return latestStatus;
}

async function captureConversation() {
  const tab = await activeTab();
  if (!tab?.id) {
    throw new Error("No active tab available.");
  }

  const accountLabel = await selectedAccountLabel();
  const response = await chrome.tabs.sendMessage(tab.id, {
    type: "ema:extractConversation",
    accountLabel,
  });
  if (!response?.ok) {
    throw new Error(response?.error || "Failed to capture conversation from this page.");
  }

  latestCapture = response;
  previewMetaEl.textContent = `${response.platform} · ${response.message_count} messages · ${response.title}`;
  return response;
}

async function downloadBundle() {
  const capture = latestCapture || await captureConversation();
  const blob = new Blob([JSON.stringify(capture.bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({
      url,
      filename: `ema-chronicle-${Date.now()}.json`,
      saveAs: true,
    });
    setStatus("Bundle downloaded.");
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

async function sendToEma() {
  const capture = latestCapture || await captureConversation();
  const baseUrl = emaUrlInput.value.trim().replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("EMA service URL is required.");
  }

  const importRes = await fetch(`${baseUrl}/api/chronicle/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(capture.bundle),
  });
  if (!importRes.ok) {
    throw new Error(`Chronicle import failed: ${importRes.status}`);
  }

  const imported = await importRes.json();
  const sessionId = imported?.detail?.session?.id;
  if (!sessionId) {
    throw new Error("EMA import succeeded but no Chronicle session id was returned.");
  }

  if (runExtractInput.checked) {
    const extractRes = await fetch(`${baseUrl}/api/chronicle/sessions/${encodeURIComponent(sessionId)}/extract`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (!extractRes.ok) {
      throw new Error(`Chronicle extraction failed: ${extractRes.status}`);
    }
  }

  setStatus(`Imported current conversation into Chronicle session ${sessionId}.`);
}

async function saveAccount() {
  const label = accountLabelInput.value.trim();
  if (!label) {
    throw new Error("Account label is required.");
  }

  const saved = await storageDefaults();
  const source = accountSourceSelect.value || activeSource();
  const account = {
    id: `${source}:${Date.now()}`,
    source,
    label,
  };

  const accounts = [...(saved.accounts || []).filter((entry) => !(entry.source === source && entry.label === label)), account];
  await chrome.storage.local.set({
    accounts,
    selectedAccountId: account.id,
  });

  accountLabelInput.value = "";
  await renderAccounts(accounts, account.id);
  setStatus(`Saved account label ${label}.`);
}

async function openLogin() {
  const response = await chrome.runtime.sendMessage({
    type: "ema:openLogin",
    source: accountSourceSelect.value || activeSource(),
  });
  if (response?.status === "needs_login") {
    setStatus(`Opened ${response.source} login page.`, false);
    return;
  }
  throw new Error(response?.detail || "Failed to open login.");
}

async function startHarvest() {
  const source = accountSourceSelect.value || activeSource();
  const status = await refreshStatus();
  if (status?.platform && status.platform !== source) {
    setStatus(`Active tab source is ${status.platform}; harvesting will use ${source}.`, false);
  }

  saveSettings();
  const response = await chrome.runtime.sendMessage({
    type: "ema:startHarvest",
    source,
    accountLabel: await selectedAccountLabel(),
    baseUrl: emaUrlInput.value.trim(),
    runExtract: runExtractInput.checked,
    limit: Number(harvestLimitInput.value) || 500,
  });

  if (response?.status === "needs_login") {
    setStatus("Login required before harvest can continue. Login page opened.", true);
    return;
  }

  setStatus("Harvest started in the background.");
}

async function refreshHarvestState() {
  const state = await chrome.runtime.sendMessage({ type: "ema:getHarvestState" });
  if (!state) return;

  const suffix = state.total ? `${state.imported}/${state.total}` : `${state.imported || 0}`;
  harvestMetaEl.textContent = `${state.status || "idle"} · ${suffix}${state.current ? ` · ${state.current}` : ""}`;
  if (state.lastError) {
    setStatus(state.lastError, true);
  }
}

saveAccountButton.addEventListener("click", async () => {
  setBusy(true);
  setStatus("");
  try {
    await saveAccount();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Account save failed.", true);
  } finally {
    setBusy(false);
  }
});

openLoginButton.addEventListener("click", async () => {
  setBusy(true);
  setStatus("");
  try {
    await openLogin();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Login open failed.", true);
  } finally {
    setBusy(false);
  }
});

refreshButton.addEventListener("click", async () => {
  setBusy(true);
  setStatus("");
  try {
    await refreshStatus();
    await captureConversation();
    setStatus("Preview refreshed.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Capture failed.", true);
  } finally {
    setBusy(false);
  }
});

downloadButton.addEventListener("click", async () => {
  setBusy(true);
  setStatus("");
  try {
    await downloadBundle();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Download failed.", true);
  } finally {
    setBusy(false);
  }
});

sendButton.addEventListener("click", async () => {
  setBusy(true);
  setStatus("");
  try {
    await saveSettings();
    await sendToEma();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Send failed.", true);
  } finally {
    setBusy(false);
  }
});

harvestButton.addEventListener("click", async () => {
  setBusy(true);
  setStatus("");
  try {
    await startHarvest();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Harvest failed.", true);
  } finally {
    setBusy(false);
  }
});

accountSourceSelect.addEventListener("change", async () => {
  const saved = await storageDefaults();
  await renderAccounts(saved.accounts || [], "");
});

accountSelect.addEventListener("change", saveSettings);
emaUrlInput.addEventListener("change", saveSettings);
runExtractInput.addEventListener("change", saveSettings);
harvestLimitInput.addEventListener("change", saveSettings);

void loadSettings()
  .then(() => refreshStatus())
  .then(() => captureConversation().catch(() => null))
  .then(() => refreshHarvestState())
  .catch((error) => {
    setStatus(error instanceof Error ? error.message : "No supported page detected.", true);
  });

window.setInterval(() => {
  void refreshHarvestState();
}, 1200);
