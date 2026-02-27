const YouTubeNotes = (() => {
  let _notes = [];
  let _isActive = false;
  let _panelEl = null;
  let _abortController = null;

  function isYouTubePage() {
    return (
      window.location.hostname.includes("youtube.com") &&
      window.location.pathname === "/watch"
    );
  }

  async function extractTranscript() {
    const videoId = new URLSearchParams(window.location.search).get("v");
    if (!videoId) {
      throw new Error("Could not find video ID in URL.");
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: "FETCH_YOUTUBE_TRANSCRIPT", videoId },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(
              new Error("Extension error: " + chrome.runtime.lastError.message),
            );
            return;
          }
          if (response?.success && response.segments?.length > 0) {
            resolve(response.segments);
          } else {
            reject(new Error(response?.error || "No transcript data received"));
          }
        },
      );
    });
  }

  function chunkTranscript(segments, intervalSec = 30) {
    const chunks = [];
    let currentChunk = { startTime: 0, endTime: intervalSec, texts: [] };

    for (const seg of segments) {
      while (seg.start >= currentChunk.endTime) {
        if (currentChunk.texts.length > 0) {
          chunks.push({
            startTime: currentChunk.startTime,
            endTime: currentChunk.endTime,
            text: currentChunk.texts.join(" "),
          });
        }
        currentChunk = {
          startTime: currentChunk.endTime,
          endTime: currentChunk.endTime + intervalSec,
          texts: [],
        };
      }
      currentChunk.texts.push(seg.text);
    }

    if (currentChunk.texts.length > 0) {
      chunks.push({
        startTime: currentChunk.startTime,
        endTime: currentChunk.endTime,
        text: currentChunk.texts.join(" "),
      });
    }

    return chunks;
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function createPanel() {
    const panel = document.createElement("div");
    panel.className = "sl-yt-panel";

    panel.innerHTML = `
          <div class="sl-yt-header">
            <h3>Video Notes</h3>
            <button class="sl-tooltip-close sl-yt-close" aria-label="Close">✕</button>
          </div>
          <div class="sl-yt-content" id="sl-yt-notes"></div>
          <div class="sl-yt-footer">
            <button class="sl-action-btn" data-export="pdf">PDF</button>
            <button class="sl-action-btn" data-export="copy">Copy</button>
            <button class="sl-action-btn sl-primary sl-yt-generate">Generate</button>
          </div>
        `;

    panel.querySelector(".sl-yt-close").addEventListener("click", () => {
      hide();
    });

    panel.querySelectorAll("[data-export]").forEach((btn) => {
      btn.addEventListener("click", () => {
        exportNotes(btn.dataset.export);
      });
    });

    panel.querySelector(".sl-yt-generate").addEventListener("click", () => {
      generateNotes();
    });

    return panel;
  }

  function renderNote(chunk, summary) {
    if (!_panelEl) return;
    const container = _panelEl.querySelector("#sl-yt-notes");

    const noteEl = document.createElement("div");
    noteEl.className = "sl-yt-chunk";
    noteEl.innerHTML = `
          <div class="sl-yt-chunk-time">${formatTime(chunk.startTime)} – ${formatTime(chunk.endTime)}</div>
          <div class="sl-yt-chunk-text">${sanitizeHTML(summary)}</div>
        `;

    container.appendChild(noteEl);
    container.scrollTop = container.scrollHeight;
  }

  function sanitizeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  async function generateNotes() {
    if (!_panelEl) return;

    const notesContainer = _panelEl.querySelector("#sl-yt-notes");
    notesContainer.innerHTML =
      '<div class="sl-loading"><div class="sl-loading-dots"><div class="sl-loading-dot"></div><div class="sl-loading-dot"></div><div class="sl-loading-dot"></div></div>Extracting transcript…</div>';

    _abortController = new AbortController();
    _notes = [];

    try {
      const segments = await extractTranscript();
      const chunks = chunkTranscript(segments);

      notesContainer.innerHTML = "";

      const videoTitle =
        document
          .querySelector("h1.ytd-watch-metadata yt-formatted-string, h1.title")
          ?.textContent?.trim() || "Video";

      for (let i = 0; i < chunks.length; i++) {
        if (_abortController.signal.aborted) return;

        const chunk = chunks[i];
        const messages = [
          {
            role: "system",
            content: `You are summarizing a segment of a YouTube video titled "${videoTitle}". Create concise, informative study notes for this segment. Use 2-3 bullet points max. No intro, just the notes.`,
          },
          {
            role: "user",
            content: `Summarize this transcript segment (${formatTime(chunk.startTime)}–${formatTime(chunk.endTime)}):\n\n"${chunk.text}"`,
          },
        ];

        let summary = "";
        for await (const resp of AIRouter.streamChat(messages, {
          maxTokens: 200,
        })) {
          if (_abortController.signal.aborted) return;
          if (resp.error) {
            summary = `Error: ${resp.error}`;
            break;
          }
          summary += resp.text;
        }

        _notes.push({
          time: `${formatTime(chunk.startTime)}–${formatTime(chunk.endTime)}`,
          summary,
        });
        renderNote(chunk, summary);

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    } catch (err) {
      notesContainer.innerHTML = `<div class="sl-error"><span class="sl-error-icon">⚠</span>${sanitizeHTML(err.message)}</div>`;
    }
  }

  function exportNotes(format) {
    if (_notes.length === 0) return;

    const videoTitle =
      document
        .querySelector("h1.ytd-watch-metadata yt-formatted-string, h1.title")
        ?.textContent?.trim() || "Video Notes";
    let content = "";
    let mimeType = "text/plain";
    let extension = "txt";

    switch (format) {
      case "pdf":
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${videoTitle}</title>
              <style>
                body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.6; color: #333; }
                h1 { font-size: 1.8rem; border-bottom: 2px solid #eee; padding-bottom: 0.5rem; margin-bottom: 1.5rem; }
                h2 { font-size: 1.2rem; color: #3b7a57; margin-top: 2rem; margin-bottom: 0.5rem; }
                p { margin: 0.5rem 0; }
                @media print { body { max-width: 100%; margin: 0; padding: 2rem; } }
              </style>
              </head>
              <body>
                <h1>${sanitizeHTML(videoTitle)}</h1>
                ${_notes
                  .map(
                    (n) => `
                  <div class="note-chunk">
                    <h2>${sanitizeHTML(n.time)}</h2>
                    <p>${sanitizeHTML(n.summary)}</p>
                  </div>
                `,
                  )
                  .join("")}
                <script>
                  window.onload = () => { setTimeout(() => window.print(), 500); };
                </script>
              </body></html>`;

        const pdfBlob = new Blob([html], { type: "text/html" });
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, "_blank");
        return;

      case "copy":
        content = `${videoTitle}\n${"=".repeat(videoTitle.length)}\n\n`;
        content += _notes.map((n) => `[${n.time}]\n${n.summary}`).join("\n\n");
        navigator.clipboard
          .writeText(content)
          .then(() => {
            const btn = _panelEl.querySelector('[data-export="copy"]');
            if (btn) {
              const originalText = btn.textContent;
              btn.textContent = "Copied!";
              setTimeout(() => {
                btn.textContent = originalText;
              }, 2000);
            }
          })
          .catch((err) => {
            console.error("Failed to copy text: ", err);
          });
        return;
    }
  }

  function show() {
    if (!isYouTubePage()) return;
    if (!_panelEl) {
      _panelEl = createPanel();
    }
    Overlay.showPanel(_panelEl);
    _isActive = true;
  }

  function hide() {
    if (_panelEl) {
      _panelEl.classList.remove("sl-visible");
      setTimeout(() => {
        _panelEl.remove();
        _panelEl = null;
      }, 300);
    }
    if (_abortController) _abortController.abort();
    _isActive = false;
  }

  return {
    isYouTubePage,
    show,
    hide,
    toggle() {
      _isActive ? hide() : show();
    },
    get isActive() {
      return _isActive;
    },
    get notes() {
      return _notes;
    },
    exportNotes,
  };
})();
