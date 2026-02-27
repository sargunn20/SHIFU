function toggleGuide(id) {
  document.getElementById(id).classList.toggle("open");
}

document.querySelectorAll(".guide-header").forEach((header) => {
  header.addEventListener("click", () => {
    header.parentElement.classList.toggle("open");
  });
});

function showToast(msg, type) {
  type = type || "success";
  var t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast " + type + " show";
  setTimeout(function () {
    t.classList.remove("show");
  }, 2500);
}

document.querySelectorAll(".tab").forEach(function (tab) {
  tab.addEventListener("click", function () {
    document.querySelectorAll(".tab").forEach(function (t) {
      t.classList.remove("active");
    });
    document.querySelectorAll(".tab-content").forEach(function (c) {
      c.classList.remove("active");
    });
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
  });
});

var MODELS = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o (Recommended)" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini (Faster)" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  ],
  gemini: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Recommended)" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  ],
  claude: [
    {
      value: "claude-sonnet-4-20250514",
      label: "Claude Sonnet 4 (Recommended)",
    },
    { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (Faster)" },
    { value: "claude-3-opus-20240229", label: "Claude 3 Opus" },
  ],
  groq: [
    { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Recommended)" },
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B (Fastest)" },
    { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
    { value: "gemma2-9b-it", label: "Gemma 2 9B" },
  ],
};

var providerSelect = document.getElementById("provider-select");
var modelSelect = document.getElementById("model-select");

function updateModels() {
  var provider = providerSelect.value;
  modelSelect.innerHTML = "";
  var models = MODELS[provider] || [];
  models.forEach(function (m) {
    var opt = document.createElement("option");
    opt.value = m.value;
    opt.textContent = m.label;
    modelSelect.appendChild(opt);
  });
}

providerSelect.addEventListener("change", updateModels);
updateModels();

function showView(viewId) {
  document.querySelectorAll(".view").forEach(function (v) {
    v.classList.remove("active");
  });
  document.getElementById(viewId).classList.add("active");
}

document.getElementById("login-form").addEventListener("submit", function (e) {
  e.preventDefault();
  var name = document.getElementById("login-name").value.trim();
  var email = document.getElementById("login-email").value.trim();
  if (!name || !email) return;

  chrome.storage.local.set({ userName: name, userEmail: email }, function () {
    loadMainView(name, email);
    showToast("Welcome, " + name + "!");
  });
});

document.getElementById("logout-btn").addEventListener("click", function () {
  chrome.storage.local.remove(["userName", "userEmail"], function () {
    showView("login-view");
  });
});

function loadMainView(name, email) {
  showView("main-view");
  document.getElementById("user-avatar").textContent = (name ||
    "U")[0].toUpperCase();
  document.getElementById("user-email").textContent = email || "";
}

chrome.storage.local.get(
  ["userName", "userEmail", "aiProvider", "apiKey", "aiModel", "defaultMode"],
  function (s) {
    if (s.userName && s.userEmail) {
      loadMainView(s.userName, s.userEmail);
    } else {
      showView("login-view");
    }

    if (s.aiProvider) providerSelect.value = s.aiProvider;
    updateModels();
    if (s.aiModel) modelSelect.value = s.aiModel;
    if (s.defaultMode)
      document.getElementById("default-mode").value = s.defaultMode;

    updateAPIStatus(!!s.apiKey, s.aiProvider);
    if (s.apiKey) document.getElementById("api-key-input").value = s.apiKey;
  },
);

function updateAPIStatus(connected, provider) {
  var dot = document.getElementById("ai-status-dot");
  var text = document.getElementById("ai-status-text");
  var badge = document.getElementById("ai-status-badge");

  if (connected) {
    dot.classList.add("active");
    var names = {
      openai: "OpenAI",
      gemini: "Gemini",
      claude: "Claude",
      groq: "Groq",
    };
    text.textContent = (names[provider] || "AI") + " connected";
    badge.textContent = "Active";
    badge.className = "status-badge connected";
  } else {
    dot.classList.remove("active");
    text.textContent = "No AI connected";
    badge.textContent = "Setup needed";
    badge.className = "status-badge disconnected";
  }
}

document.getElementById("save-api-btn").addEventListener("click", function () {
  var provider = providerSelect.value;
  var key = document.getElementById("api-key-input").value.trim();
  var model = modelSelect.value;
  var mode = document.getElementById("default-mode").value;

  if (!key) {
    showToast("Please enter an API key", "error");
    return;
  }

  chrome.storage.local.set(
    {
      aiProvider: provider,
      apiKey: key,
      aiModel: model,
      defaultMode: mode,
    },
    function () {
      updateAPIStatus(true, provider);
      showToast("Settings saved ✓");
      document.querySelector('.tab[data-tab="home"]').click();
    },
  );
});

document
  .getElementById("default-mode")
  .addEventListener("change", function (e) {
    chrome.storage.local.set({ defaultMode: e.target.value });
  });

document.getElementById("expand-btn").addEventListener("click", function () {
  chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
});

if (window.innerWidth > 420) {
  document.body.classList.add("expanded");
}

document
  .getElementById("action-screenshot")
  .addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs[0]) return;
      chrome.runtime.sendMessage({
        type: "CAPTURE_AND_EXPLAIN",
        tabId: tabs[0].id,
      });
      window.close();
    });
  });

document
  .getElementById("action-youtube")
  .addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs[0]) return;
      var url = tabs[0].url || "";
      if (!url.includes("youtube.com/watch")) {
        showToast("Open a YouTube video first", "error");
        return;
      }
      chrome.runtime.sendMessage(
        {
          type: "TOGGLE_YOUTUBE_NOTES",
          tabId: tabs[0].id,
        },
        function (response) {
          if (chrome.runtime.lastError) {
            showToast("Extension error, please reload page", "error");
            return;
          }
          if (response && response.success) {
            window.close();
          } else {
            showToast("Failed to initialize Shifu on this page", "error");
          }
        },
      );
    });
  });

document
  .getElementById("open-shortcuts")
  .addEventListener("click", function (e) {
    e.preventDefault();
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });

chrome.storage.local.get(["explanationCache"], function (r) {
  var cache = r.explanationCache || {};
  var count = Object.keys(cache).length;
  document.getElementById("cache-stats").textContent =
    count + " cached explanation" + (count !== 1 ? "s" : "");
});

document
  .getElementById("clear-cache-btn")
  .addEventListener("click", function () {
    chrome.storage.local.remove(["explanationCache"], function () {
      document.getElementById("cache-stats").textContent =
        "0 cached explanations";
      showToast("Cache cleared ✓");
    });
  });

function loadNotesCount() {
  chrome.storage.local.get(["sl_notes"], function (r) {
    var notes = r.sl_notes || [];
    var count = notes.length;
    document.getElementById("notes-count").textContent = count;
  });
}

loadNotesCount();

document
  .getElementById("export-notes-btn")
  .addEventListener("click", function () {
    chrome.storage.local.get(["sl_notes"], function (r) {
      var notes = r.sl_notes || [];
      if (notes.length === 0) {
        showToast("No notes to export", "error");
        return;
      }

      var grouped = {};
      notes.forEach(function (n) {
        var key = n.pageUrl || "Unknown Page";
        if (!grouped[key])
          grouped[key] = { title: n.pageTitle || "Untitled", notes: [] };
        grouped[key].notes.push(n);
      });

      var notesHtml = "";
      Object.keys(grouped).forEach(function (url) {
        var group = grouped[url];
        notesHtml += '<div class="page-group">';
        notesHtml += "<h2>" + escapeForPDF(group.title) + "</h2>";
        notesHtml += '<p class="page-url">' + escapeForPDF(url) + "</p>";
        group.notes.forEach(function (n, i) {
          notesHtml += '<div class="note-card">';
          notesHtml += '<div class="note-num">' + (i + 1) + "</div>";
          notesHtml += "<blockquote>" + escapeForPDF(n.text) + "</blockquote>";
          if (n.comment)
            notesHtml +=
              '<div class="note-comment"><strong>My Notes:</strong> ' +
              escapeForPDF(n.comment) +
              "</div>";
          if (n.aiExplanation)
            notesHtml +=
              '<div class="note-ai"><strong>AI Explanation:</strong> ' +
              escapeForPDF(n.aiExplanation) +
              "</div>";
          notesHtml +=
            '<div class="note-time">Saved: ' +
            new Date(n.timestamp).toLocaleString() +
            "</div>";
          notesHtml += "</div>";
        });
        notesHtml += "</div>";
      });

      var html =
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Shifu Notes</title>' +
        "<style>" +
        "@page { margin: 1.5cm; }" +
        "* { box-sizing: border-box; margin: 0; padding: 0; }" +
        'body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; color: #1a1a2e; line-height: 1.6; padding: 20px; background: #fff; }' +
        ".header { text-align: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 3px solid #3b7a57; }" +
        ".header h1 { font-size: 28px; color: #3b7a57; margin-bottom: 4px; }" +
        ".header .date { font-size: 12px; color: #888; }" +
        ".page-group { margin-bottom: 28px; }" +
        ".page-group h2 { font-size: 18px; color: #2d2d44; margin-bottom: 2px; }" +
        ".page-url { font-size: 11px; color: #3b7a57; margin-bottom: 12px; word-break: break-all; }" +
        ".note-card { background: #f8f7ff; border: 1px solid #e8e6ff; border-left: 4px solid #3b7a57; border-radius: 8px; padding: 14px 16px; margin-bottom: 12px; page-break-inside: avoid; }" +
        ".note-num { font-size: 11px; font-weight: 700; color: #3b7a57; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }" +
        "blockquote { font-size: 14px; color: #333; border-left: none; padding: 0; margin: 0 0 8px 0; font-style: italic; }" +
        ".note-comment { font-size: 13px; color: #444; margin-bottom: 6px; padding: 8px 10px; background: #fff; border-radius: 6px; border: 1px solid #eee; }" +
        ".note-ai { font-size: 13px; color: #2d6a4f; margin-bottom: 6px; padding: 8px 10px; background: #f0fdf4; border-radius: 6px; border: 1px solid #d1fae5; }" +
        ".note-time { font-size: 10px; color: #999; text-align: right; }" +
        "</style></head><body>" +
        '<div class="header"><h1>Shifu Notes</h1><p class="date">Exported on ' +
        new Date().toLocaleString() +
        "</p></div>" +
        notesHtml +
        "</body></html>";

      var printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = function () {
          printWindow.print();
        };
      }
      showToast("PDF export opened ✓");
    });
  });

function escapeForPDF(str) {
  var div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

document
  .getElementById("clear-notes-btn")
  .addEventListener("click", function () {
    if (
      confirm(
        "Are you sure you want to delete ALL notes? This cannot be undone.",
      )
    ) {
      chrome.storage.local.set({ sl_notes: [] }, function () {
        loadNotesCount();
        showToast("All notes cleared ✓");
      });
    }
  });
