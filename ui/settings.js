document.addEventListener("DOMContentLoaded", () => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const providerSelect = $("#provider-select");
  const apiKeyInput = $("#api-key-input");
  const modelSelect = $("#model-select");
  const defaultModeSelect = $("#default-mode");
  const saveBtn = $("#save-btn");
  const statusEl = $("#status");
  const docFileInput = $("#doc-file-input");
  const docUploadBtn = $("#doc-upload-btn");
  const docListEl = $("#doc-list");
  const clearCacheBtn = $("#clear-cache-btn");
  const cacheStatsEl = $("#cache-stats");

  const MODEL_OPTIONS = {
    openai: [
      { value: "gpt-4o-mini", label: "GPT-4o Mini (fast, cheap)" },
      { value: "gpt-4o", label: "GPT-4o (best)" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (cheapest)" },
    ],
    gemini: [
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (fast)" },
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (best)" },
      { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    ],
    claude: [
      { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (best)" },
      { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
      { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku (fast)" },
    ],
  };

  function loadSettings() {
    chrome.storage.local.get(
      [
        "provider",
        "apiKey_openai",
        "apiKey_gemini",
        "apiKey_claude",
        "model_openai",
        "model_gemini",
        "model_claude",
        "defaultMode",
      ],
      (data) => {
        const provider = data.provider || "openai";
        providerSelect.value = provider;
        updateModelOptions(provider);

        apiKeyInput.value = data[`apiKey_${provider}`] || "";
        modelSelect.value =
          data[`model_${provider}`] || MODEL_OPTIONS[provider][0].value;
        defaultModeSelect.value = data.defaultMode || "student";
      },
    );

    loadCacheStats();
    loadDocList();
  }

  function updateModelOptions(provider) {
    const options = MODEL_OPTIONS[provider] || [];
    modelSelect.innerHTML = options
      .map((o) => `<option value="${o.value}">${o.label}</option>`)
      .join("");
  }

  providerSelect.addEventListener("change", () => {
    const provider = providerSelect.value;
    updateModelOptions(provider);

    chrome.storage.local.get(`apiKey_${provider}`, (data) => {
      apiKeyInput.value = data[`apiKey_${provider}`] || "";
    });

    chrome.storage.local.get(`model_${provider}`, (data) => {
      const saved = data[`model_${provider}`];
      if (saved) modelSelect.value = saved;
    });
  });

  saveBtn.addEventListener("click", () => {
    const provider = providerSelect.value;
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;

    const settings = {
      provider,
      [`apiKey_${provider}`]: apiKey,
      [`model_${provider}`]: model,
      defaultMode: defaultModeSelect.value,

      aiProvider: provider,
      apiKey: apiKey,
      aiModel: model,
    };

    chrome.storage.local.set(settings, () => {
      showStatus("✓ Settings saved", "success");
    });
  });

  function showStatus(msg, type = "success") {
    statusEl.textContent = msg;
    statusEl.className = `settings-status ${type}`;
    statusEl.classList.remove("hidden");
    setTimeout(() => statusEl.classList.add("hidden"), 2500);
  }

  async function loadCacheStats() {
    try {
      const stats = await getCacheStats();
      cacheStatsEl.textContent = `${stats.count} cached explanations`;
    } catch {
      cacheStatsEl.textContent = "0 cached explanations";
    }
  }

  function getCacheStats() {
    return new Promise((resolve) => {
      chrome.storage.local.get("sl_cache", (data) => {
        const cache = data.sl_cache || { order: [] };
        resolve({ count: cache.order.length });
      });
    });
  }

  clearCacheBtn.addEventListener("click", () => {
    chrome.storage.local.remove("sl_cache", () => {
      loadCacheStats();
      showStatus("Cache cleared");
    });
  });

  docUploadBtn.addEventListener("click", () => {
    docFileInput.click();
  });

  docFileInput.addEventListener("change", async () => {
    const file = docFileInput.files[0];
    if (!file) return;

    docUploadBtn.disabled = true;
    docUploadBtn.textContent = "Uploading…";

    try {
      const text = await readFile(file);
      if (!text || text.trim().length < 10) {
        throw new Error("File is empty or too small");
      }

      await addDocToVectorDB(file.name, text);

      showStatus(`✓ "${file.name}" uploaded`);
      loadDocList();
    } catch (err) {
      showStatus(`Error: ${err.message}`, "error");
    } finally {
      docUploadBtn.disabled = false;
      docUploadBtn.textContent = "Upload";
      docFileInput.value = "";
    }
  });

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }

  const STOP_WORDS = new Set([
    "the",
    "be",
    "to",
    "of",
    "and",
    "a",
    "in",
    "that",
    "have",
    "i",
    "it",
    "for",
    "not",
    "on",
    "with",
    "he",
    "as",
    "you",
    "do",
    "at",
    "this",
    "but",
    "his",
    "by",
    "from",
    "they",
    "we",
    "say",
    "her",
    "she",
    "or",
    "an",
    "will",
    "my",
    "one",
    "all",
    "would",
    "there",
    "their",
    "what",
    "so",
    "up",
    "out",
    "if",
    "about",
    "who",
    "get",
    "which",
    "go",
    "me",
    "when",
    "make",
    "can",
    "like",
    "time",
    "no",
    "just",
    "him",
    "know",
    "take",
    "people",
    "into",
    "year",
    "your",
    "good",
    "some",
    "could",
    "them",
    "see",
    "other",
    "than",
    "then",
    "now",
    "look",
    "only",
    "come",
    "its",
    "over",
    "think",
    "also",
    "back",
    "after",
    "use",
    "two",
    "how",
    "our",
    "way",
    "even",
    "new",
    "want",
    "because",
    "any",
    "these",
    "give",
    "day",
    "most",
    "was",
    "are",
    "has",
    "been",
    "were",
  ]);

  function tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  }

  function rebuildIDF(chunks) {
    const docCount = chunks.length;
    const docFreq = {};
    chunks.forEach((chunk) => {
      const uniqueTerms = new Set(tokenize(chunk.text));
      uniqueTerms.forEach((term) => {
        docFreq[term] = (docFreq[term] || 0) + 1;
      });
    });
    const idf = {};
    for (const [term, df] of Object.entries(docFreq)) {
      idf[term] = Math.log((docCount + 1) / (df + 1)) + 1;
    }
    return idf;
  }

  function buildVector(tokens, idf) {
    const tf = {};
    tokens.forEach((t) => {
      tf[t] = (tf[t] || 0) + 1;
    });
    const vec = {};
    const maxTf = Math.max(...Object.values(tf), 1);
    for (const [term, count] of Object.entries(tf)) {
      const normalizedTf = count / maxTf;
      const idfVal = idf[term] || 1;
      vec[term] = normalizedTf * idfVal;
    }
    return vec;
  }

  async function addDocToVectorDB(name, text) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get("sl_vectordb", (data) => {
        const db = data.sl_vectordb || { documents: [], chunks: [], idf: {} };

        db.chunks = db.chunks.filter((c) => c.docName !== name);
        db.documents = db.documents.filter((d) => d.name !== name);

        const CHUNK_SIZE = 500;
        const CHUNK_OVERLAP = 50;
        const newChunks = [];
        const docId = Date.now().toString(36);
        let start = 0,
          idx = 0;
        while (start < text.length) {
          const chunk = text.substring(start, start + CHUNK_SIZE).trim();
          if (chunk.length > 20) {
            newChunks.push({
              id: `${docId}_${idx}`,
              docName: name,
              text: chunk,
              index: idx,
            });
            idx++;
          }
          start += CHUNK_SIZE - CHUNK_OVERLAP;
        }

        db.chunks.push(...newChunks);
        db.documents.push({
          name,
          addedAt: Date.now(),
          chunkCount: newChunks.length,
        });

        db.idf = rebuildIDF(db.chunks);
        db.chunks.forEach((chunk) => {
          chunk.vector = buildVector(tokenize(chunk.text), db.idf);
        });

        chrome.storage.local.set({ sl_vectordb: db }, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve();
        });
      });
    });
  }

  async function loadDocList() {
    chrome.storage.local.get("sl_vectordb", (data) => {
      const db = data.sl_vectordb || { documents: [] };
      if (db.documents.length === 0) {
        docListEl.innerHTML =
          '<div class="doc-empty">No documents uploaded</div>';
        return;
      }

      docListEl.innerHTML = db.documents
        .map(
          (doc) => `
        <div class="doc-item">
          <span class="doc-name">${escapeHtml(doc.name)}</span>
          <span class="doc-chunks">${doc.chunkCount} chunks</span>
          <button class="doc-delete" data-name="${escapeHtml(doc.name)}">✕</button>
        </div>
      `,
        )
        .join("");

      docListEl.querySelectorAll(".doc-delete").forEach((btn) => {
        btn.addEventListener("click", () => {
          deleteDoc(btn.dataset.name);
        });
      });
    });
  }

  function deleteDoc(name) {
    chrome.storage.local.get("sl_vectordb", (data) => {
      const db = data.sl_vectordb || { documents: [], chunks: [], idf: {} };
      db.chunks = db.chunks.filter((c) => c.docName !== name);
      db.documents = db.documents.filter((d) => d.name !== name);

      chrome.storage.local.set({ sl_vectordb: db }, () => {
        showStatus(`Deleted "${name}"`);
        loadDocList();
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  loadSettings();
});
