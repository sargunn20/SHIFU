const NotesPanel = (() => {
  let _panelEl = null;
  let _isVisible = false;

  function createPanel() {
    const panel = document.createElement("div");
    panel.className = "sl-notes-panel";

    panel.innerHTML = `
            <div class="sl-notes-header">
                <span class="sl-notes-title">My Notes</span>
                <div class="sl-notes-header-actions">
                    <button class="sl-notes-export-btn" title="Export as PDF">Export PDF</button>
                    <button class="sl-notes-close" aria-label="Close">✕</button>
                </div>
            </div>
            <div class="sl-notes-list"></div>
            <div class="sl-notes-empty">
                <div class="sl-notes-empty-icon">—</div>
                <p>No notes yet for this page</p>
                <p class="sl-notes-empty-hint">Select text and click <strong>Save</strong> in the tooltip to add notes</p>
            </div>
        `;

    panel
      .querySelector(".sl-notes-close")
      .addEventListener("click", () => hide());

    panel
      .querySelector(".sl-notes-export-btn")
      .addEventListener("click", async () => {
        const allNotes = await Notes.getAll();
        if (allNotes.length === 0) {
          showPanelToast(panel, "No notes to export");
          return;
        }
        exportNotesAsPDF(allNotes);
        showPanelToast(panel, "✓ PDF export opened!");
      });

    panel.addEventListener("mousedown", (e) => e.stopPropagation());

    panel.style.cssText = `
            position: fixed;
            top: 0;
            right: -400px;
            width: 380px;
            height: 100vh;
            z-index: 2147483646;
            display: flex;
            flex-direction: column;
            transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: auto;
        `;

    return panel;
  }

  function showPanelToast(panel, message) {
    let toast = panel.querySelector(".sl-notes-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "sl-notes-toast";
      panel.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("sl-show");
    setTimeout(() => toast.classList.remove("sl-show"), 2000);
  }

  function createNoteCard(note) {
    const card = document.createElement("div");
    card.className = "sl-note-card";
    card.dataset.noteId = note.id;

    const truncatedText =
      note.text.length > 200 ? note.text.substring(0, 200) + "…" : note.text;

    card.innerHTML = `
            <div class="sl-note-highlight">
                <span class="sl-note-quote-mark">"</span>
                <span class="sl-note-text">${escapeHtml(truncatedText)}</span>
            </div>
            <div class="sl-note-comment-section">
                <textarea class="sl-note-comment" placeholder="Add your notes here…" rows="2">${escapeHtml(note.comment || "")}</textarea>
            </div>
            <div class="sl-note-ai-section ${note.aiExplanation ? "" : "sl-hidden"}">
                <div class="sl-note-ai-label">AI Explanation</div>
                <div class="sl-note-ai-text">${escapeHtml(note.aiExplanation || "")}</div>
            </div>
            <div class="sl-note-actions">
                <button class="sl-note-ai-btn" title="Get AI explanation">Explain</button>
                <span class="sl-note-time">${formatTime(note.timestamp)}</span>
                <button class="sl-note-delete" title="Delete note">×</button>
            </div>
        `;

    const textarea = card.querySelector(".sl-note-comment");
    textarea.addEventListener("blur", async () => {
      await Notes.update(note.id, { comment: textarea.value });
    });

    card
      .querySelector(".sl-note-ai-btn")
      .addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = "⏳ Generating…";

        const aiSection = card.querySelector(".sl-note-ai-section");
        const aiText = card.querySelector(".sl-note-ai-text");
        aiSection.classList.remove("sl-hidden");
        aiText.textContent = "";

        aiSection.classList.add("sl-generating");

        await Notes.generateExplanation(
          note.id,
          (chunk) => {
            aiText.textContent += chunk;
          },
          () => {
            btn.textContent = "Explain";
            btn.disabled = false;
            aiSection.classList.remove("sl-generating");
          },
          (err) => {
            aiText.textContent = "⚠ " + err;
            btn.textContent = "Explain";
            btn.disabled = false;
            aiSection.classList.remove("sl-generating");
          },
        );
      });

    card
      .querySelector(".sl-note-delete")
      .addEventListener("click", async () => {
        await Notes.remove(note.id);
        card.style.transform = "translateX(100%)";
        card.style.opacity = "0";
        setTimeout(() => {
          card.remove();
          updateEmptyState();
        }, 300);
      });

    return card;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function formatTime(timestamp) {
    const d = new Date(timestamp);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000) return "just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
    return d.toLocaleDateString();
  }

  function updateEmptyState() {
    if (!_panelEl) return;
    const list = _panelEl.querySelector(".sl-notes-list");
    const empty = _panelEl.querySelector(".sl-notes-empty");
    if (list.children.length === 0) {
      empty.style.display = "flex";
    } else {
      empty.style.display = "none";
    }
  }

  async function loadNotes() {
    if (!_panelEl) return;
    const list = _panelEl.querySelector(".sl-notes-list");
    list.innerHTML = "";

    const notes = await Notes.getByPage(window.location.href);

    notes.forEach((note) => {
      list.appendChild(createNoteCard(note));
    });

    updateEmptyState();
  }

  function show() {
    if (_isVisible) {
      hide();
      return;
    }

    if (!_panelEl) {
      _panelEl = createPanel();
    }

    Overlay.injectElement(_panelEl);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        _panelEl.style.right = "0";
      });
    });

    _isVisible = true;
    loadNotes();
  }

  function hide() {
    if (!_panelEl || !_isVisible) return;
    _panelEl.style.right = "-400px";
    _isVisible = false;

    setTimeout(() => {
      if (_panelEl && _panelEl.parentNode) {
        _panelEl.parentNode.removeChild(_panelEl);
      }
    }, 300);
  }

  function exportNotesAsPDF(notes) {
    const grouped = {};
    notes.forEach((n) => {
      const key = n.pageUrl || "Unknown Page";
      if (!grouped[key])
        grouped[key] = { title: n.pageTitle || "Untitled", notes: [] };
      grouped[key].notes.push(n);
    });

    let notesHtml = "";
    for (const [url, group] of Object.entries(grouped)) {
      notesHtml += `<div class="page-group">`;
      notesHtml += `<h2>${escapeHtml(group.title)}</h2>`;
      notesHtml += `<p class="page-url">${escapeHtml(url)}</p>`;

      group.notes.forEach((n, i) => {
        notesHtml += `<div class="note-card">`;
        notesHtml += `<div class="note-num">${i + 1}</div>`;
        notesHtml += `<blockquote>${escapeHtml(n.text)}</blockquote>`;
        if (n.comment) {
          notesHtml += `<div class="note-comment"><strong>My Notes:</strong> ${escapeHtml(n.comment)}</div>`;
        }
        if (n.aiExplanation) {
          notesHtml += `<div class="note-ai"><strong>AI Explanation:</strong> ${escapeHtml(n.aiExplanation)}</div>`;
        }
        notesHtml += `<div class="note-time">Saved: ${new Date(n.timestamp).toLocaleString()}</div>`;
        notesHtml += `</div>`;
      });
      notesHtml += `</div>`;
    }

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Shifu Notes</title>
<style>
  @page { margin: 1.5cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a2e; line-height: 1.6; padding: 20px; background: #fff; }
  .header { text-align: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 3px solid #3b7a57; }
  .header h1 { font-size: 28px; color: #3b7a57; margin-bottom: 4px; }
  .header .date { font-size: 12px; color: #888; }
  .page-group { margin-bottom: 28px; }
  .page-group h2 { font-size: 18px; color: #2d2d44; margin-bottom: 2px; }
  .page-url { font-size: 11px; color: #3b7a57; margin-bottom: 12px; word-break: break-all; }
  .note-card { background: #f8f7ff; border: 1px solid #e8e6ff; border-left: 4px solid #3b7a57; border-radius: 8px; padding: 14px 16px; margin-bottom: 12px; page-break-inside: avoid; }
  .note-num { font-size: 11px; font-weight: 700; color: #3b7a57; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  blockquote { font-size: 14px; color: #333; border-left: none; padding: 0; margin: 0 0 8px 0; font-style: italic; }
  .note-comment { font-size: 13px; color: #444; margin-bottom: 6px; padding: 8px 10px; background: #fff; border-radius: 6px; border: 1px solid #eee; }
  .note-ai { font-size: 13px; color: #2d6a4f; margin-bottom: 6px; padding: 8px 10px; background: #f0fdf4; border-radius: 6px; border: 1px solid #d1fae5; }
  .note-time { font-size: 10px; color: #999; text-align: right; }
</style></head><body>
<div class="header"><h1>Shifu Notes</h1><p class="date">Exported on ${new Date().toLocaleString()}</p></div>
${notesHtml}
</body></html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => printWindow.print();
    }
  }

  return {
    show,
    hide,
    toggle: show,
    loadNotes,
    get isVisible() {
      return _isVisible;
    },
  };
})();
