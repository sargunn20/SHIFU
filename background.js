function safeSendMessage(tabId, message) {
  chrome.tabs.sendMessage(tabId, message).catch(() => {});
}

const CONTENT_JS_FILES = [
  "storage/cache.js",
  "core/context.js",
  "core/selection.js",
  "core/overlay.js",
  "ai/router.js",
  "ai/openai.js",
  "ai/gemini.js",
  "ai/claude.js",
  "ai/groq.js",
  "features/explain.js",
  "features/chat.js",
  "features/image.js",
  "features/youtubeNotes.js",
  "features/notes.js",
  "ui/tooltip.js",
  "ui/notesPanel.js",
  "content.js",
];

async function ensureInjected(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
  } catch (err) {
    console.log(`[Shifu] Injecting scripts into tab ${tabId}...`);

    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["styles.css"],
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: CONTENT_JS_FILES,
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: "shifu-explain",
    title: "Shifu: Explain Selection",
    contexts: ["selection"],
  });
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === "shifu-explain") {
    await ensureInjected(tab.id);
    safeSendMessage(tab.id, {
      type: "EXPLAIN_SELECTION",
      mode: "student",
    });
  }
});
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab?.id) return;
  await ensureInjected(tab.id);
  switch (command) {
    case "explain-selection":
      safeSendMessage(tab.id, { type: "EXPLAIN_SELECTION", mode: null });
      break;
    case "image-explain":
      captureAndExplain(tab.id);
      break;
    case "toggle-youtube-notes":
      safeSendMessage(tab.id, { type: "TOGGLE_YOUTUBE_NOTES" });
      break;
    case "toggle-notes-panel":
      safeSendMessage(tab.id, { type: "TOGGLE_NOTES_PANEL" });
      break;
  }
});
async function captureAndExplain(tabId) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: "jpeg",
      quality: 80,
    });
    safeSendMessage(tabId, {
      type: "IMAGE_EXPLAIN",
      imageData: dataUrl,
    });
  } catch (err) {
    console.error("[Shifu] Screenshot capture failed:", err);
    safeSendMessage(tabId, {
      type: "EXPLAIN_ERROR",
      error: "Failed to capture screenshot. Make sure the tab is active.",
    });
  }
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "CAPTURE_AND_EXPLAIN": {
      const targetTabId = message.tabId || sender.tab?.id;
      if (targetTabId) {
        ensureInjected(targetTabId).then(() => captureAndExplain(targetTabId));
      }
      break;
    }
    case "TOGGLE_YOUTUBE_NOTES": {
      const targetTabId = message.tabId || sender.tab?.id;
      if (targetTabId) {
        ensureInjected(targetTabId).then(() => {
          safeSendMessage(targetTabId, { type: "TOGGLE_YOUTUBE_NOTES" });
          sendResponse({ success: true });
        });
        return true;
      }
      break;
    }
    case "TOGGLE_NOTES_PANEL": {
      const targetTabId = message.tabId || sender.tab?.id;
      if (targetTabId) {
        ensureInjected(targetTabId).then(() => {
          safeSendMessage(targetTabId, { type: "TOGGLE_NOTES_PANEL" });
          sendResponse({ success: true });
        });
        return true;
      }
      break;
    }
    case "SEND_TO_CONTENT": {
      if (message.tabId && message.contentMessage) {
        ensureInjected(message.tabId).then(() => {
          safeSendMessage(message.tabId, message.contentMessage);
          sendResponse({ success: true });
        });
        return true;
      }
      break;
    }
    case "CAPTURE_TAB":
      chrome.tabs
        .captureVisibleTab(null, { format: "jpeg", quality: 80 })
        .then((dataUrl) => sendResponse({ success: true, dataUrl }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case "GET_SETTINGS":
      chrome.storage.local.get(
        ["aiProvider", "apiKey", "aiModel", "defaultMode"],
        (data) => sendResponse(data),
      );
      return true;
    case "SAVE_SETTINGS":
      chrome.storage.local.set(message.settings, () =>
        sendResponse({ success: true }),
      );
      return true;
    case "FETCH_YOUTUBE_TRANSCRIPT":
      fetchTranscriptViaMainWorld(sender.tab.id)
        .then((segments) => sendResponse({ success: true, segments }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
  }
});
async function fetchTranscriptViaMainWorld(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async function () {
      try {
        function waitForElements(selector, timeout = 8000) {
          return new Promise((resolve) => {
            const existing = document.querySelectorAll(selector);
            if (existing.length > 0) {
              resolve(existing);
              return;
            }
            const observer = new MutationObserver(() => {
              const els = document.querySelectorAll(selector);
              if (els.length > 0) {
                observer.disconnect();
                resolve(els);
              }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            setTimeout(() => {
              observer.disconnect();
              resolve(document.querySelectorAll(selector));
            }, timeout);
          });
        }

        let segments = document.querySelectorAll(
          "ytd-transcript-segment-renderer",
        );
        let panelWasAlreadyOpen = segments.length > 0;
        if (segments.length === 0) {
          const allButtons = Array.from(
            document.querySelectorAll("button, tp-yt-paper-button"),
          );
          let transcriptBtn = allButtons.find((b) => {
            const label = (b.getAttribute("aria-label") || "").toLowerCase();
            const text = (b.textContent || "").toLowerCase().trim();
            return label === "show transcript" || text === "show transcript";
          });

          if (!transcriptBtn) {
            transcriptBtn = allButtons.find((b) => {
              const text = (b.textContent || "").toLowerCase().trim();
              return text === "transcript";
            });
          }

          if (!transcriptBtn) {
            const expandBtn = document.querySelector(
              "#expand, tp-yt-paper-button#expand",
            );
            if (expandBtn) {
              expandBtn.click();
              await new Promise((r) => setTimeout(r, 500));
              const allBtns2 = Array.from(
                document.querySelectorAll("button, tp-yt-paper-button"),
              );
              transcriptBtn = allBtns2.find((b) => {
                const label = (
                  b.getAttribute("aria-label") || ""
                ).toLowerCase();
                const text = (b.textContent || "").toLowerCase().trim();
                return (
                  label === "show transcript" ||
                  text === "show transcript" ||
                  text === "transcript"
                );
              });
            }
          }
          if (!transcriptBtn) {
            return {
              error:
                'Could not find "Show transcript" button. This video may not have a transcript available.',
            };
          }

          transcriptBtn.click();

          segments = await waitForElements(
            "ytd-transcript-segment-renderer",
            8000,
          );
        }
        if (!segments || segments.length === 0) {
          return {
            error: "Transcript panel opened but no segments loaded. Try again.",
          };
        }

        const result = [];
        segments.forEach((seg) => {
          const timestampEl = seg.querySelector(".segment-timestamp");
          const textEl = seg.querySelector(".segment-text");
          if (textEl) {
            const text = textEl.textContent?.trim();
            if (!text) return;
            let startSec = 0;
            if (timestampEl) {
              const ts = timestampEl.textContent?.trim() || "0:00";
              const parts = ts.split(":").map(Number);
              if (parts.length === 3) {
                startSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
              } else if (parts.length === 2) {
                startSec = parts[0] * 60 + parts[1];
              } else {
                startSec = parts[0] || 0;
              }
            }
            result.push({
              start: startSec,
              duration: 0,
              text: text,
            });
          }
        });

        if (!panelWasAlreadyOpen) {
          const closeBtn = document.querySelector(
            'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"] #visibility-button button',
          );
          if (closeBtn) closeBtn.click();
        }
        if (result.length === 0) {
          return {
            error: "Found transcript segments in DOM but could not parse text.",
          };
        }
        return { segments: result };
      } catch (e) {
        return { error: "Transcript extraction failed: " + e.message };
      }
    },
  });

  const result = results?.[0]?.result;
  if (!result) {
    throw new Error("Script execution returned no result");
  }
  if (result.error) {
    throw new Error(result.error);
  }
  if (!result.segments || result.segments.length === 0) {
    throw new Error("No transcript segments extracted");
  }
  return result.segments;
}
