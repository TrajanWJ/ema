(function () {
  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) return "chatgpt";
    if (host.includes("claude.ai")) return "claude.ai";
    return "web";
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function absoluteUrl(href) {
    try {
      return new URL(href, window.location.origin).toString();
    } catch {
      return null;
    }
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function candidateTitle() {
    const titleNode = document.querySelector("h1, header h2, main h1");
    const heading = cleanText(titleNode?.textContent || "");
    if (heading) return heading;
    return cleanText(document.title.replace(/\s*[-|].*$/, "")) || "Imported browser conversation";
  }

  function loginUrl() {
    return detectPlatform() === "claude.ai" ? "https://claude.ai/login" : "https://chatgpt.com/auth/login";
  }

  function currentConversationId() {
    const url = new URL(window.location.href);
    const match =
      url.pathname.match(/\/c\/([^/]+)/)
      || url.pathname.match(/\/chat\/([^/]+)/)
      || url.pathname.match(/\/project\/[^/]+\/chat\/([^/]+)/);
    return match?.[1] || url.pathname || null;
  }

  function queryMessagesForChatGPT() {
    const nodes = Array.from(document.querySelectorAll("[data-message-author-role]"));
    return nodes.map((node) => ({
      role: node.getAttribute("data-message-author-role") || "unknown",
      content: cleanText(node.textContent || ""),
    }));
  }

  function queryMessagesForClaude() {
    const selectors = [
      "[data-testid='user-message']",
      "[data-testid='assistant-message']",
      "[data-testid*='message']",
      "main article",
      "main section",
    ];
    const nodes = [];
    for (const selector of selectors) {
      const found = Array.from(document.querySelectorAll(selector));
      if (found.length > 0) nodes.push(...found);
    }
    return nodes.map((node) => {
      const testId = node.getAttribute("data-testid") || "";
      const text = cleanText(node.textContent || "");
      let role = "unknown";
      if (testId.includes("user")) role = "user";
      else if (testId.includes("assistant")) role = "assistant";
      else if (/^you\b/i.test(text)) role = "user";
      return { role, content: text };
    });
  }

  function queryGenericMessages() {
    const nodes = Array.from(document.querySelectorAll("main article, main [role='article'], main section"));
    return nodes.map((node) => ({
      role: "unknown",
      content: cleanText(node.textContent || ""),
    }));
  }

  function uniqueMessages(messages) {
    const seen = new Set();
    return messages.filter((message) => {
      const key = `${message.role}|${message.content}`;
      if (!message.content || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function collectMessages() {
    const platform = detectPlatform();
    const raw =
      platform === "chatgpt" ? queryMessagesForChatGPT()
      : platform === "claude.ai" ? queryMessagesForClaude()
      : queryGenericMessages();

    return uniqueMessages(raw)
      .map((message, index) => ({
        external_id: `${platform}-message-${index + 1}`,
        occurred_at: null,
        role:
          message.role === "user" || message.role === "assistant" || message.role === "system" || message.role === "tool"
            ? message.role
            : "unknown",
        kind: "message",
        content: message.content,
        metadata: {
          platform,
          url: window.location.href,
        },
      }));
  }

  function looksLoggedIn() {
    const platform = detectPlatform();
    const url = new URL(window.location.href);
    const bodyText = cleanText(document.body?.innerText || "");

    if (platform === "claude.ai" && url.pathname.startsWith("/login")) return false;
    if (platform === "chatgpt" && url.pathname.startsWith("/auth")) return false;

    const loginButton = Array.from(document.querySelectorAll("a, button"))
      .some((node) => /log in|sign in|continue with google|continue with email/i.test(cleanText(node.textContent || "")));

    const hasMessages = collectMessages().length > 0;
    const hasConversationLinks = collectConversationLinks().length > 0;

    if (hasMessages || hasConversationLinks) return true;
    if (loginButton && /log in|continue with google|continue with email/i.test(bodyText)) return false;
    return true;
  }

  function conversationLinkSelectors(platform) {
    if (platform === "claude.ai") {
      return [
        "a[href*='/chat/']",
        "aside a[href*='/chat/']",
        "nav a[href*='/chat/']",
      ];
    }

    return [
      "a[href^='/c/']",
      "a[href*='/c/']",
      "aside a[href*='/c/']",
      "nav a[href*='/c/']",
    ];
  }

  function collectConversationLinks() {
    const platform = detectPlatform();
    const selectors = conversationLinkSelectors(platform);
    const map = new Map();

    for (const selector of selectors) {
      const nodes = Array.from(document.querySelectorAll(selector));
      for (const node of nodes) {
        const href = node.getAttribute("href");
        if (!href) continue;
        const url = absoluteUrl(href);
        if (!url) continue;
        if (platform === "chatgpt" && !/\/c\//.test(url)) continue;
        if (platform === "claude.ai" && !/\/chat\//.test(url)) continue;
        const title = cleanText(node.textContent || node.getAttribute("title") || "");
        map.set(url, {
          id: url,
          url,
          title: title || `Conversation ${map.size + 1}`,
        });
      }
    }

    return Array.from(map.values());
  }

  function sidebarScrollContainer() {
    const platform = detectPlatform();
    const selectors =
      platform === "claude.ai"
        ? ["aside", "nav", "[class*='sidebar']", "[data-testid*='sidebar']"]
        : ["nav", "aside", "[class*='sidebar']", "[data-testid*='history']"];

    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (!node) continue;
      if (node.scrollHeight > node.clientHeight) return node;
    }
    return null;
  }

  async function listConversations() {
    const container = sidebarScrollContainer();
    const seen = new Map();

    for (let index = 0; index < 24; index += 1) {
      for (const conversation of collectConversationLinks()) {
        seen.set(conversation.url, conversation);
      }

      if (!container) break;
      const before = container.scrollTop;
      container.scrollTop = container.scrollHeight;
      await delay(250);
      if (container.scrollTop === before) break;
    }

    const currentUrl = window.location.href;
    if (!seen.has(currentUrl) && currentConversationId()) {
      seen.set(currentUrl, {
        id: currentConversationId(),
        url: currentUrl,
        title: candidateTitle(),
      });
    }

    return Array.from(seen.values());
  }

  function buildBundle(accountLabel) {
    const platform = detectPlatform();
    const messages = collectMessages();
    const title = candidateTitle();
    const labelSuffix = accountLabel ? `:${accountLabel}` : "";

    return {
      source: {
        kind: platform === "claude.ai" ? "claude" : "import",
        label: `browser:${platform}${labelSuffix}`,
        provenance_root: window.location.origin,
      },
      session: {
        external_id: currentConversationId(),
        title,
        summary: messages[0]?.content?.slice(0, 240) || null,
        project_hint: null,
        started_at: null,
        ended_at: null,
        provenance_path: window.location.href,
        metadata: {
          captured_from: "ema_chrome_extension",
          platform,
          source_account_label: accountLabel || null,
          page_title: document.title,
        },
        entries: messages,
        artifacts: [
          {
            name: `${platform}-capture.html`,
            kind: "export",
            mime_type: "text/html",
            text_content: document.documentElement.outerHTML,
            metadata: {
              captured_at: new Date().toISOString(),
              url: window.location.href,
              source_account_label: accountLabel || null,
            },
          },
        ],
        raw_payload: {
          platform,
          url: window.location.href,
          title: document.title,
          account_label: accountLabel || null,
          captured_at: new Date().toISOString(),
          message_count: messages.length,
        },
      },
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== "string") return;

    if (message.type === "ema:getStatus") {
      sendResponse({
        ok: true,
        platform: detectPlatform(),
        loggedIn: looksLoggedIn(),
        loginUrl: loginUrl(),
        title: candidateTitle(),
        currentUrl: window.location.href,
        currentConversationId: currentConversationId(),
        messageCount: collectMessages().length,
      });
      return;
    }

    if (message.type === "ema:listConversations") {
      (async () => {
        try {
          const conversations = await listConversations();
          sendResponse({
            ok: true,
            platform: detectPlatform(),
            loggedIn: looksLoggedIn(),
            conversations,
          });
        } catch (error) {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : "conversation_listing_failed",
          });
        }
      })();
      return true;
    }

    if (message.type === "ema:extractConversation") {
      try {
        const bundle = buildBundle(
          typeof message.accountLabel === "string" ? message.accountLabel : null,
        );
        sendResponse({
          ok: true,
          platform: detectPlatform(),
          title: bundle.session.title,
          url: window.location.href,
          message_count: bundle.session.entries.length,
          bundle,
        });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "capture_failed",
        });
      }
      return true;
    }
  });
})();
