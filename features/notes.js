const Notes = (() => {
  const STORAGE_KEY = "sl_notes";

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  async function loadAll() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        resolve(result[STORAGE_KEY] || []);
      });
    });
  }

  async function saveAll(notes) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: notes }, resolve);
    });
  }

  return {
    async add(text, pageUrl, pageTitle, comment = "", aiExplanation = "") {
      const notes = await loadAll();
      const note = {
        id: generateId(),
        text: text.trim(),
        comment,
        aiExplanation,
        pageUrl,
        pageTitle: pageTitle || "Untitled Page",
        timestamp: Date.now(),
      };
      notes.unshift(note);
      await saveAll(notes);
      return note;
    },

    async update(id, fields) {
      const notes = await loadAll();
      const idx = notes.findIndex((n) => n.id === id);
      if (idx === -1) return null;
      Object.assign(notes[idx], fields);
      await saveAll(notes);
      return notes[idx];
    },

    async remove(id) {
      const notes = await loadAll();
      const filtered = notes.filter((n) => n.id !== id);
      await saveAll(filtered);
    },

    async getByPage(url) {
      const notes = await loadAll();
      return notes.filter((n) => n.pageUrl === url);
    },

    async getAll() {
      return loadAll();
    },

    async getCount() {
      const notes = await loadAll();
      return notes.length;
    },

    async clearAll() {
      await saveAll([]);
    },

    async generateExplanation(noteId, onChunk, onDone, onError) {
      const notes = await loadAll();
      const note = notes.find((n) => n.id === noteId);
      if (!note) {
        onError("Note not found");
        return;
      }

      const messages = [
        {
          role: "system",
          content:
            "You are a helpful study assistant. Provide a clear, concise explanation of the highlighted text. Keep it educational and under 150 words.",
        },
        {
          role: "user",
          content: `Explain this highlighted text:\n\n"${note.text}"`,
        },
      ];

      try {
        let fullText = "";
        for await (const chunk of AIRouter.streamChat(messages)) {
          if (chunk.error) {
            onError(chunk.error);
            return;
          }
          fullText += chunk.text;
          onChunk(chunk.text);
          if (chunk.done) break;
        }

        await this.update(noteId, { aiExplanation: fullText });
        onDone(fullText);
      } catch (err) {
        onError(err.message);
      }
    },

    async exportAsMarkdown(notes) {
      if (!notes) notes = await loadAll();
      if (notes.length === 0) return "# Shifu Notes\n\nNo notes saved yet.";

      const grouped = {};
      notes.forEach((n) => {
        const key = n.pageUrl || "Unknown Page";
        if (!grouped[key]) grouped[key] = { title: n.pageTitle, notes: [] };
        grouped[key].notes.push(n);
      });

      let md = "# Shifu Notes\n\n";
      md += `_Exported on ${new Date().toLocaleString()}_\n\n---\n\n`;

      for (const [url, group] of Object.entries(grouped)) {
        md += `## ${group.title}\n`;
        md += `${url}\n\n`;

        group.notes.forEach((n, i) => {
          md += `### ${i + 1}. Highlight\n\n`;
          md += `> ${n.text}\n\n`;

          if (n.comment) {
            md += `**My Notes:** ${n.comment}\n\n`;
          }
          if (n.aiExplanation) {
            md += `**AI Explanation:** ${n.aiExplanation}\n\n`;
          }

          md += `_Saved: ${new Date(n.timestamp).toLocaleString()}_\n\n---\n\n`;
        });
      }

      return md;
    },
  };
})();
