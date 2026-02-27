(async function ShifuInit() {
  "use strict";

  if (window.__shifu_initialized) return;
  window.__shifu_initialized = true;

  const isPdfPage = (() => {
    const url = window.location.href.toLowerCase();

    if (url.endsWith(".pdf") || url.includes(".pdf?") || url.includes(".pdf#"))
      return true;

    const embed = document.querySelector('embed[type="application/pdf"]');
    if (embed) return true;

    const ct = document.contentType || "";
    if (ct === "application/pdf") return true;
    return false;
  })();

  if (isPdfPage) {
    console.log("[Shifu] PDF page detected — enabling screenshot mode");

    let defaultMode = "student";
    try {
      const settings = await new Promise((resolve) => {
        chrome.storage.local.get(["defaultMode"], resolve);
      });
      defaultMode = settings.defaultMode || "student";
    } catch {}

    Overlay.init(() => {
      Explain.cancel();
      Chat.cancel();
    });

    let lastPdfSelection = null;

    Selection.init((selectionData) => {
      lastPdfSelection = selectionData;

      const selBtn = document.querySelector(".sl-pdf-explain-sel");
      if (selBtn) {
        selBtn.style.display =
          selectionData && selectionData.text ? "flex" : "none";
      }
    });

    document.addEventListener("mousedown", () => {
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          lastPdfSelection = null;
          const selBtn = document.querySelector(".sl-pdf-explain-sel");
          if (selBtn) selBtn.style.display = "none";
        }
      }, 200);
    });

    const pdfBar = document.createElement("div");
    pdfBar.id = "shifu-pdf-bar";
    pdfBar.innerHTML = `
            <div class="sl-pdf-bar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
                </svg>
                <span class="sl-pdf-label">Shifu</span>
                <button class="sl-pdf-btn sl-pdf-explain-sel" style="display:none" title="Explain selected text">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                    Explain Selection
                </button>
                <button class="sl-pdf-btn sl-pdf-explain" title="Explain visible page (⌘⇧L)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                    </svg>
                    Explain Page
                </button>
                <button class="sl-pdf-btn sl-pdf-notes" title="Open notes panel (⌘⇧N)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    Notes
                </button>
                <button class="sl-pdf-minimize" title="Minimize">−</button>
            </div>
        `;

    const pdfStyle = document.createElement("style");
    pdfStyle.textContent = `
            #shifu-pdf-bar {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 2147483647;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            }
            .sl-pdf-bar {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: rgba(18, 26, 36, 0.95);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(59, 122, 87, 0.3);
                border-radius: 14px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05);
                color: #e8e8ef;
                font-size: 13px;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                animation: sl-pdf-slide-in 0.4s ease-out;
            }
            .sl-pdf-bar.sl-minimized {
                padding: 6px 10px;
                gap: 0;
            }
            .sl-pdf-bar.sl-minimized .sl-pdf-label,
            .sl-pdf-bar.sl-minimized .sl-pdf-btn {
                display: none !important;
            }
            .sl-pdf-bar.sl-minimized .sl-pdf-minimize {
                font-size: 16px;
            }
            .sl-pdf-bar svg {
                flex-shrink: 0;
                color: #3b7a57;
            }
            .sl-pdf-label {
                font-weight: 600;
                font-size: 12px;
                color: #8b8b9e;
                margin-right: 4px;
            }
            .sl-pdf-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                background: rgba(59, 122, 87, 0.15);
                border: 1px solid rgba(59, 122, 87, 0.25);
                border-radius: 8px;
                color: #e8e8ef;
                font-size: 12px;
                font-weight: 500;
                font-family: inherit;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
            }
            .sl-pdf-btn:hover {
                background: rgba(59, 122, 87, 0.3);
                border-color: rgba(59, 122, 87, 0.5);
                transform: translateY(-1px);
            }
            .sl-pdf-btn:active {
                transform: translateY(0);
            }
            .sl-pdf-btn.sl-pdf-explain {
                background: linear-gradient(135deg, rgba(59, 122, 87, 0.25), rgba(44, 82, 130, 0.25));
                border-color: rgba(59, 122, 87, 0.4);
            }
            .sl-pdf-btn.sl-pdf-explain:hover {
                background: linear-gradient(135deg, rgba(59, 122, 87, 0.4), rgba(44, 82, 130, 0.4));
            }
            .sl-pdf-btn.sl-pdf-explain-sel {
                background: linear-gradient(135deg, rgba(44, 82, 130, 0.25), rgba(59, 122, 87, 0.25));
                border-color: rgba(44, 82, 130, 0.4);
            }
            .sl-pdf-btn.sl-pdf-explain-sel:hover {
                background: linear-gradient(135deg, rgba(44, 82, 130, 0.4), rgba(59, 122, 87, 0.4));
            }
            .sl-pdf-minimize {
                background: none;
                border: none;
                color: #5a5a6e;
                font-size: 18px;
                cursor: pointer;
                padding: 2px 6px;
                line-height: 1;
                font-family: inherit;
                border-radius: 4px;
                transition: color 0.2s;
            }
            .sl-pdf-minimize:hover {
                color: #e8e8ef;
            }
            @keyframes sl-pdf-slide-in {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;

    document.head.appendChild(pdfStyle);
    document.body.appendChild(pdfBar);

    const explainBtn = pdfBar.querySelector(".sl-pdf-explain");
    const explainSelBtn = pdfBar.querySelector(".sl-pdf-explain-sel");
    const notesBtn = pdfBar.querySelector(".sl-pdf-notes");
    const minimizeBtn = pdfBar.querySelector(".sl-pdf-minimize");
    const barEl = pdfBar.querySelector(".sl-pdf-bar");

    explainBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "CAPTURE_AND_EXPLAIN" });
    });

    explainSelBtn.addEventListener("click", () => {
      const sel = lastPdfSelection || Selection.getCurrent();
      if (sel && sel.text) {
        Tooltip.show(sel, defaultMode);
      }
    });

    notesBtn.addEventListener("click", () => {
      NotesPanel.toggle();
    });

    minimizeBtn.addEventListener("click", () => {
      const isMinimized = barEl.classList.toggle("sl-minimized");
      minimizeBtn.textContent = isMinimized ? "+" : "−";
      minimizeBtn.title = isMinimized ? "Expand" : "Minimize";
    });

    chrome.runtime.onMessage.addListener((message) => {
      switch (message.type) {
        case "IMAGE_EXPLAIN":
          Tooltip.showImage(message.imageData);
          break;
        case "EXPLAIN_SELECTION": {
          const sel = lastPdfSelection || Selection.getCurrent();
          if (sel && sel.text) {
            const mode = message.mode || defaultMode;
            Tooltip.show(sel, mode);
          }
          break;
        }
        case "TOGGLE_NOTES_PANEL":
          NotesPanel.toggle();
          break;
      }
    });

    chrome.storage.local.get(["aiProvider", "apiKey"], (d) => {
      const hasKey = !!d.apiKey;
      const provider = d.aiProvider || "openai";
      console.log(
        `[Shifu] PDF Mode ✓ | Provider: ${provider} | API Key: ${hasKey ? "configured ✓" : "NOT SET ✗"}`,
      );
    });

    return;
  }

  let defaultMode = "student";

  try {
    const settings = await new Promise((resolve) => {
      chrome.storage.local.get(["defaultMode"], resolve);
    });
    defaultMode = settings.defaultMode || "student";
  } catch {}

  Overlay.init(() => {
    Explain.cancel();
    Chat.cancel();
  });

  let lastSelection = null;

  Selection.init((selectionData) => {
    lastSelection = selectionData;
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case "EXPLAIN_SELECTION": {
        const sel = lastSelection || Selection.getCurrent();
        if (!sel || !sel.text) {
          return;
        }
        const mode = message.mode || defaultMode;
        Tooltip.show(sel, mode);
        break;
      }

      case "IMAGE_EXPLAIN": {
        Tooltip.showImage(message.imageData);
        break;
      }

      case "TOGGLE_YOUTUBE_NOTES": {
        if (YouTubeNotes.isYouTubePage()) {
          YouTubeNotes.toggle();
        }
        sendResponse({ ok: true });
        break;
      }

      case "TOGGLE_NOTES_PANEL": {
        NotesPanel.toggle();
        break;
      }

      case "PING": {
        sendResponse({ status: "alive" });
        break;
      }

      case "EXPLAIN_ERROR": {
        console.error("[Shifu]", message.error);
        break;
      }
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.defaultMode) {
      defaultMode = changes.defaultMode.newValue || "student";
    }
  });

  chrome.storage.local.get(["aiProvider", "apiKey"], (d) => {
    const hasKey = !!d.apiKey;
    const provider = d.aiProvider || "openai";
    console.log(
      `[Shifu] Initialized ✓ | Provider: ${provider} | API Key: ${hasKey ? "configured ✓" : "NOT SET ✗"}`,
    );
  });
})();
