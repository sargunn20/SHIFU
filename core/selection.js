const Selection = (() => {
  let _onSelect = null;
  let _debounceTimer = null;
  const DEBOUNCE_MS = 150;

  function getSurroundingContext(range) {
    try {
      let container = range.commonAncestorContainer;

      if (container.nodeType === Node.TEXT_NODE) {
        container = container.parentElement;
      }

      const blockTags = [
        "P",
        "DIV",
        "ARTICLE",
        "SECTION",
        "LI",
        "BLOCKQUOTE",
        "TD",
        "PRE",
      ];
      let block = container;
      while (block && !blockTags.includes(block.tagName)) {
        block = block.parentElement;
      }

      if (block) {
        const text = block.textContent.trim();

        return text.length > 500 ? text.substring(0, 500) + "…" : text;
      }

      return "";
    } catch {
      return "";
    }
  }

  function handleSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;

    const text = sel.toString().trim();
    if (text.length < 2) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const surrounding = getSurroundingContext(range);

    if (_onSelect) {
      _onSelect({
        text,
        rect: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        },
        surroundingParagraph: surrounding,
        pageUrl: window.location.href,
      });
    }
  }

  function onMouseUp() {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(handleSelection, DEBOUNCE_MS);
  }

  function getCurrentSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return null;

    const text = sel.toString().trim();
    if (text.length < 2) return null;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    return {
      text,
      rect: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      },
      surroundingParagraph: getSurroundingContext(range),
      pageUrl: window.location.href,
    };
  }

  return {
    init(callback) {
      _onSelect = callback;
      document.addEventListener("mouseup", onMouseUp, { passive: true });
    },

    getCurrent: getCurrentSelection,

    destroy() {
      document.removeEventListener("mouseup", onMouseUp);
      clearTimeout(_debounceTimer);
      _onSelect = null;
    },
  };
})();
