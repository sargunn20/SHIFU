const Tooltip = (() => {
  let _currentEl = null;
  let _currentSelectionData = null;
  let _currentMode = "student";
  let _fullExplanation = "";
  let _isStreaming = false;
  let _chatVisible = false;

  function applyInlineMarkdown(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
  }

  function formatText(text) {
    if (!text) return "";

    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const blocks = escaped
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter(Boolean);

    return blocks
      .map((block) => {
        const lines = block
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        const isUnordered =
          lines.length > 0 && lines.every((l) => /^[\-*•]\s+/.test(l));
        const isOrdered =
          lines.length > 0 && lines.every((l) => /^\d+\.\s+/.test(l));

        if (isUnordered) {
          const items = lines
            .map((l) => l.replace(/^[\-*•]\s+/, ""))
            .map((l) => `<li>${applyInlineMarkdown(l)}</li>`)
            .join("");
          return `<ul>${items}</ul>`;
        }

        if (isOrdered) {
          const items = lines
            .map((l) => l.replace(/^\d+\.\s+/, ""))
            .map((l) => `<li>${applyInlineMarkdown(l)}</li>`)
            .join("");
          return `<ol>${items}</ol>`;
        }

        const paragraph = applyInlineMarkdown(block).replace(/\n/g, "<br>");
        return `<p>${paragraph}</p>`;
      })
      .join("");
  }

  function constrainToViewport(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();

    const maxLeft = Math.max(0, window.innerWidth - rect.width);
    const maxTop = Math.max(0, window.innerHeight - rect.height);

    let left = rect.left;
    let top = rect.top;

    if (left < 0) left = 0;
    if (top < 0) top = 0;
    if (left > maxLeft) left = maxLeft;
    if (top > maxTop) top = maxTop;

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.transform = "none";
  }

  function createTooltipEl(mode) {
    const el = document.createElement("div");
    el.className = "sl-tooltip";

    const modeButtons = Object.entries(Explain.MODES)
      .map(
        ([id, m]) =>
          `<button class="sl-mode-tab ${id === mode ? "sl-active" : ""}" data-mode="${id}">${m.label}</button>`,
      )
      .join("");

    el.innerHTML = `
      <div class="sl-tooltip-header">
        <span class="sl-tooltip-title">Shifu</span>
        <div class="sl-header-actions">
            <button class="sl-action-btn sl-primary sl-chat-btn">Chat</button>
            <button class="sl-action-btn sl-save-note-btn" title="Save to Notes">Save</button>
            <button class="sl-action-btn sl-copy-btn" title="Copy to Clipboard">Copy</button>
            <button class="sl-tooltip-close" aria-label="Close">✕</button>
        </div>
      </div>
      <div class="sl-mode-tabs">${modeButtons}</div>
      <div class="sl-tooltip-content" tabindex="0">
        <div class="sl-loading">
          <div class="sl-loading-dots">
            <div class="sl-loading-dot"></div>
            <div class="sl-loading-dot"></div>
            <div class="sl-loading-dot"></div>
          </div>
          Thinking…
        </div>
      </div>
      <div class="sl-chat-panel sl-hidden">
        <div class="sl-chat-messages"></div>
        <div class="sl-chat-input-row">
          <input class="sl-chat-input" type="text" placeholder="Ask a follow-up…" />
          <button class="sl-chat-send" disabled>Send</button>
        </div>
      </div>
    `;

    el.style.cssText += "display:flex;flex-direction:column;overflow:hidden;";
    const contentEl = el.querySelector(".sl-tooltip-content");
    contentEl.style.cssText =
      "flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;";

    el.querySelector(".sl-tooltip-close").addEventListener("click", (e) => {
      e.stopPropagation();
      hide();
    });

    el.querySelectorAll(".sl-mode-tab").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const newMode = btn.dataset.mode;
        if (newMode === _currentMode && !_isStreaming) return;
        switchMode(newMode);
      });
    });

    el.querySelector(".sl-copy-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      copyExplanation(el);
    });

    el.querySelector(".sl-chat-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleChat(el);
    });

    el.querySelector(".sl-save-note-btn").addEventListener(
      "click",
      async (e) => {
        e.stopPropagation();
        const btn = e.currentTarget;
        if (!_currentSelectionData) return;

        try {
          await Notes.add(
            _currentSelectionData.text,
            window.location.href,
            document.title,
            "",
            _fullExplanation || "",
          );
          btn.textContent = "✓ Saved";
          btn.style.color = "#4ade80";
          setTimeout(() => {
            btn.textContent = "Save";
            btn.style.color = "";
          }, 1500);
        } catch (err) {
          btn.textContent = "⚠ Error";
          setTimeout(() => {
            btn.textContent = "Save";
          }, 1500);
        }
      },
    );

    const chatInput = el.querySelector(".sl-chat-input");
    const chatSend = el.querySelector(".sl-chat-send");

    chatInput.addEventListener("input", () => {
      chatSend.disabled = !chatInput.value.trim();
    });

    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && chatInput.value.trim()) {
        e.preventDefault();
        sendChatMessage(el);
      }
      e.stopPropagation();
    });

    chatSend.addEventListener("click", (e) => {
      e.stopPropagation();
      sendChatMessage(el);
    });

    el.addEventListener("mousedown", (e) => e.stopPropagation());
    el.addEventListener("click", (e) => e.stopPropagation());

    const header = el.querySelector(".sl-tooltip-header");
    header.style.cursor = "move";

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    header.addEventListener("mousedown", (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = el.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const rect = el.getBoundingClientRect();
      const maxLeft = Math.max(0, window.innerWidth - rect.width);
      const maxTop = Math.max(0, window.innerHeight - rect.height);

      const nextLeft = Math.max(0, Math.min(initialLeft + dx, maxLeft));
      const nextTop = Math.max(0, Math.min(initialTop + dy, maxTop));

      el.style.left = `${nextLeft}px`;
      el.style.top = `${nextTop}px`;
      el.style.transform = "none";
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
      constrainToViewport(el);
    });

    window.addEventListener("resize", () => {
      constrainToViewport(el);
    });

    return el;
  }

  function updateContent(el, fullText, isStreaming) {
    const contentEl = el.querySelector(".sl-tooltip-content");
    const html = formatText(fullText);
    contentEl.innerHTML =
      html + (isStreaming ? '<span class="sl-cursor"></span>' : "");
  }

  function showError(el, message) {
    const contentEl = el.querySelector(".sl-tooltip-content");
    contentEl.innerHTML = `<div class="sl-error"><span class="sl-error-icon">⚠</span> ${formatText(message)}</div>`;
  }

  function switchMode(newMode) {
    _currentMode = newMode;
    if (!_currentEl || !_currentSelectionData) return;

    _currentEl.querySelectorAll(".sl-mode-tab").forEach((btn) => {
      btn.classList.toggle("sl-active", btn.dataset.mode === newMode);
    });

    runExplanation(_currentEl, _currentSelectionData, newMode);
  }

  function runExplanation(el, selectionData, mode) {
    _isStreaming = true;
    _fullExplanation = "";

    const contentEl = el.querySelector(".sl-tooltip-content");
    contentEl.innerHTML =
      '<div class="sl-loading"><div class="sl-loading-dots"><div class="sl-loading-dot"></div><div class="sl-loading-dot"></div><div class="sl-loading-dot"></div></div>Thinking…</div>';

    Explain.run(
      selectionData,
      mode,
      (chunk) => {
        if (_fullExplanation === "" && chunk.length > 0) {
          contentEl.innerHTML = "";
        }
        _fullExplanation += chunk;
        updateContent(el, _fullExplanation, true);
      },
      (fullText) => {
        _isStreaming = false;
        _fullExplanation = fullText;
        contentEl.innerHTML = formatText(_fullExplanation);
      },
      (error) => {
        _isStreaming = false;
        showError(el, error);
      },
    );
  }

  async function copyExplanation(el) {
    if (!_fullExplanation) return;

    try {
      await navigator.clipboard.writeText(_fullExplanation);
      const btn = el.querySelector(".sl-copy-btn");
      const originalText = btn.textContent;
      btn.textContent = "✓";
      btn.classList.add("sl-copied");
      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove("sl-copied");
      }, 1500);
    } catch {}
  }

  function toggleChat(el) {
    _chatVisible = !_chatVisible;
    const chatPanel = el.querySelector(".sl-chat-panel");
    chatPanel.classList.toggle("sl-hidden", !_chatVisible);

    if (_chatVisible) {
      el.classList.add("sl-expanded");
      Chat.init({
        selectedText: _currentSelectionData?.text || "",
        explanation: _fullExplanation,
        surroundingParagraph: _currentSelectionData?.surroundingParagraph || "",
        pageTopic: Context.extract().topic,
      });
      el.querySelector(".sl-chat-input").focus();
    } else {
      el.classList.remove("sl-expanded");
    }

    constrainToViewport(el);
  }

  function sendChatMessage(el) {
    const input = el.querySelector(".sl-chat-input");
    const messagesEl = el.querySelector(".sl-chat-messages");
    const message = input.value.trim();
    if (!message) return;

    const userMsgEl = document.createElement("div");
    userMsgEl.className = "sl-chat-msg sl-user";
    userMsgEl.textContent = message;
    messagesEl.appendChild(userMsgEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    input.value = "";
    input.disabled = true;
    el.querySelector(".sl-chat-send").disabled = true;

    const assistantMsgEl = document.createElement("div");
    assistantMsgEl.className = "sl-chat-msg sl-assistant";
    assistantMsgEl.innerHTML = '<span class="sl-cursor"></span>';
    messagesEl.appendChild(assistantMsgEl);

    let responseText = "";
    Chat.send(
      message,
      (chunk) => {
        responseText += chunk;
        assistantMsgEl.innerHTML =
          formatText(responseText) + '<span class="sl-cursor"></span>';
        messagesEl.scrollTop = messagesEl.scrollHeight;
      },
      () => {
        assistantMsgEl.innerHTML = formatText(responseText);
        input.disabled = false;
        input.focus();
      },
      (error) => {
        assistantMsgEl.innerHTML = `<span style="color:var(--sl-error)">⚠ ${error}</span>`;
        input.disabled = false;
      },
    );
  }

  function show(selectionData, mode) {
    hide();

    _currentSelectionData = selectionData;
    _currentMode = mode || "student";
    _fullExplanation = "";
    _chatVisible = false;

    _currentEl = createTooltipEl(_currentMode);
    Overlay.show(_currentEl, selectionData.rect, { persistent: true });
    requestAnimationFrame(() => constrainToViewport(_currentEl));

    runExplanation(_currentEl, _currentSelectionData, _currentMode);
  }

  function showImage(imageDataUrl) {
    hide();

    _currentSelectionData = null;
    _currentMode = "student";
    _fullExplanation = "";
    _chatVisible = false;

    const el = document.createElement("div");
    el.className = "sl-tooltip";

    el.innerHTML = `
      <div class="sl-tooltip-header">
        <span class="sl-tooltip-title">Image Analysis</span>
        <div class="sl-header-actions">
            <button class="sl-action-btn sl-save-note-btn" title="Save to Notes">Save</button>
            <button class="sl-action-btn sl-copy-btn" title="Copy to Clipboard">Copy</button>
            <button class="sl-tooltip-close" aria-label="Close">✕</button>
        </div>
      </div>
      <div class="sl-tooltip-content" tabindex="0">
        <div class="sl-loading">
          <div class="sl-loading-dots">
            <div class="sl-loading-dot"></div>
            <div class="sl-loading-dot"></div>
            <div class="sl-loading-dot"></div>
          </div>
          Analyzing screenshot…
        </div>
      </div>
    `;

    el.style.cssText += "display:flex;flex-direction:column;overflow:hidden;";
    const imageContentEl = el.querySelector(".sl-tooltip-content");
    imageContentEl.style.cssText =
      "flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;";

    el.querySelector(".sl-tooltip-close").addEventListener("click", () =>
      hide(),
    );
    el.querySelector(".sl-copy-btn").addEventListener("click", () =>
      copyExplanation(el),
    );
    el.querySelector(".sl-save-note-btn").addEventListener(
      "click",
      async (e) => {
        e.stopPropagation();
        const btn = e.currentTarget;
        try {
          await Notes.add(
            "Screenshot analysis",
            window.location.href,
            document.title,
            "",
            _fullExplanation || "",
          );
          btn.textContent = "✓ Saved";
          btn.style.color = "#4ade80";
          setTimeout(() => {
            btn.textContent = "Save";
            btn.style.color = "";
          }, 1500);
        } catch (err) {
          btn.textContent = "⚠ Error";
          setTimeout(() => {
            btn.textContent = "Save";
          }, 1500);
        }
      },
    );
    el.addEventListener("mousedown", (e) => e.stopPropagation());

    _currentEl = el;

    const rect = {
      top: window.innerHeight / 2 - 100,
      bottom: window.innerHeight / 2,
      left: window.innerWidth / 2 - 130,
      right: window.innerWidth / 2 + 130,
      width: 260,
      height: 0,
    };

    Overlay.show(el, rect, { persistent: true });
    requestAnimationFrame(() => constrainToViewport(el));

    ImageExplain.run(
      imageDataUrl,
      (chunk) => {
        _fullExplanation += chunk;
        updateContent(el, _fullExplanation, true);
      },
      () => updateContent(el, _fullExplanation, false),
      (error) => showError(el, error),
    );
  }

  function hide() {
    Explain.cancel();
    Chat.cancel();
    Overlay.dismiss();

    _currentEl = null;
    _currentSelectionData = null;
    _fullExplanation = "";
    _isStreaming = false;
    _chatVisible = false;
  }

  return {
    show,
    showImage,
    hide,
    get isVisible() {
      return _currentEl !== null;
    },
  };
})();
