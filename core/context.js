const Context = (() => {
  function getMetaDescription() {
    const meta =
      document.querySelector('meta[name="description"]') ||
      document.querySelector('meta[property="og:description"]');
    return meta ? meta.content.trim() : "";
  }

  function getHeadings() {
    const headings = [];
    document.querySelectorAll("h1, h2, h3, h4").forEach((h) => {
      const text = h.textContent.trim();
      if (text) {
        headings.push({
          level: parseInt(h.tagName[1]),
          text: text.substring(0, 120),
        });
      }
    });
    return headings.slice(0, 20);
  }

  function getMainContent() {
    const candidates = [
      document.querySelector("article"),
      document.querySelector('[role="main"]'),
      document.querySelector("main"),
      document.querySelector(".post-content"),
      document.querySelector(".article-content"),
      document.querySelector(".entry-content"),
      document.querySelector("#content"),
    ].filter(Boolean);

    let bestEl = candidates[0] || null;

    if (!bestEl) {
      const paragraphs = document.querySelectorAll("p");
      if (paragraphs.length > 0) {
        const parentMap = new Map();
        paragraphs.forEach((p) => {
          const parent = p.parentElement;
          if (!parent) return;
          const count = (parentMap.get(parent) || 0) + 1;
          parentMap.set(parent, count);
        });

        let maxCount = 0;
        parentMap.forEach((count, parent) => {
          if (count > maxCount) {
            maxCount = count;
            bestEl = parent;
          }
        });
      }
    }

    if (!bestEl) return "";

    const paragraphs = bestEl.querySelectorAll("p, li");
    const texts = [];
    let totalLen = 0;
    const MAX_LEN = 1500;

    for (const p of paragraphs) {
      const text = p.textContent.trim();
      if (text.length < 10) continue;
      if (totalLen + text.length > MAX_LEN) {
        texts.push(text.substring(0, MAX_LEN - totalLen) + "…");
        break;
      }
      texts.push(text);
      totalLen += text.length;
    }

    return texts.join("\n\n");
  }

  function inferTopic() {
    const title = document.title || "";
    const h1 = document.querySelector("h1");
    const h1Text = h1 ? h1.textContent.trim() : "";
    const desc = getMetaDescription();

    return [h1Text || title, desc]
      .filter(Boolean)
      .join(" — ")
      .substring(0, 200);
  }

  return {
    extract() {
      return {
        url: window.location.href,
        title: document.title || "",
        description: getMetaDescription(),
        headings: getHeadings(),
        mainContent: getMainContent(),
        topic: inferTopic(),
      };
    },

    getCompactContext() {
      const ctx = this.extract();
      const parts = [];

      if (ctx.topic) parts.push(`Page: ${ctx.topic}`);
      if (ctx.headings.length > 0) {
        parts.push("Headings: " + ctx.headings.map((h) => h.text).join(" > "));
      }
      if (ctx.mainContent) {
        const truncated =
          ctx.mainContent.length > 600
            ? ctx.mainContent.substring(0, 600) + "…"
            : ctx.mainContent;
        parts.push(`Content: ${truncated}`);
      }

      return parts.join("\n");
    },
  };
})();
