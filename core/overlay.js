const Overlay = (() => {
  let _hostElement = null;
  let _shadowRoot = null;
  let _container = null;
  let _isVisible = false;
  let _isPersistent = false;
  let _dismissTimer = null;
  let _onDismiss = null;

  const AUTO_DISMISS_MS = 60000;

  function createHost() {
    if (_hostElement) return;

    _hostElement = document.createElement("shifu-overlay");
    _hostElement.setAttribute("aria-hidden", "true");
    _hostElement.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483640;pointer-events:none;";
    document.body.appendChild(_hostElement);

    _shadowRoot = _hostElement.attachShadow({ mode: "closed" });

    const styleLink = document.createElement("link");
    styleLink.rel = "stylesheet";
    styleLink.href = chrome.runtime.getURL("styles.css");
    _shadowRoot.appendChild(styleLink);

    _container = document.createElement("div");
    _container.className = "sl-overlay-root";
    _shadowRoot.appendChild(_container);

    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("keydown", handleKeyDown, true);
  }

  function handleClickOutside(e) {
    if (!_isVisible) return;
    if (_isPersistent) return;
    if (_hostElement && _hostElement.contains(e.target)) return;
    dismiss();
  }

  function handleKeyDown(e) {
    if (!_isVisible) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      dismiss();
    }
  }

  function positionNearSelection(element, selectionRect) {
    const padding = 8;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    element.style.visibility = "hidden";
    element.style.display = "flex";
    element.style.position = "fixed";

    const elRect = element.getBoundingClientRect();
    const elW = elRect.width || 260;
    const elH = elRect.height || 200;

    let left = selectionRect.right + padding;
    let top = selectionRect.top;

    if (left + elW > viewportW - padding) {
      const leftSpace = selectionRect.left;
      if (leftSpace > elW + padding) {
        left = selectionRect.left - elW - padding;
      } else {
        left = selectionRect.left + selectionRect.width / 2 - elW / 2;
        top = selectionRect.bottom + padding;

        if (top + elH > viewportH - padding) {
          top = selectionRect.top - elH - padding;
        }
      }
    }

    if (top < padding) top = padding;
    if (top + elH > viewportH - padding) {
      top = viewportH - elH - padding;
    }

    if (left < padding) left = padding;
    if (left + elW > viewportW - padding) left = viewportW - elW - padding;

    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    element.style.visibility = "visible";
  }

  function dismiss() {
    if (!_isVisible) return;
    _isVisible = false;
    clearTimeout(_dismissTimer);

    if (_container) {
      const tooltip = _container.querySelector(".sl-tooltip");
      if (tooltip) {
        tooltip.classList.remove("sl-visible");
        setTimeout(() => {
          _container.innerHTML = "";
        }, 250);
      } else {
        _container.innerHTML = "";
      }
    }

    if (_onDismiss) _onDismiss();
  }

  return {
    init(onDismiss) {
      _onDismiss = onDismiss;
      createHost();
    },

    show(content, selectionRect, options = {}) {
      createHost();
      _container.innerHTML = "";
      _container.appendChild(content);
      _container.style.pointerEvents = "auto";

      positionNearSelection(content, selectionRect);

      requestAnimationFrame(() => {
        const tooltip = content.classList.contains("sl-tooltip")
          ? content
          : content.querySelector(".sl-tooltip");
        if (tooltip) tooltip.classList.add("sl-visible");
      });

      _isVisible = true;
      _isPersistent = !!options.persistent;
      _hostElement.setAttribute("aria-hidden", "false");

      clearTimeout(_dismissTimer);
      if (!_isPersistent) {
        _dismissTimer = setTimeout(dismiss, AUTO_DISMISS_MS);
      }
    },

    showPanel(panel) {
      createHost();
      _container.appendChild(panel);
      _container.style.pointerEvents = "auto";

      requestAnimationFrame(() => {
        panel.classList.add("sl-visible");
      });

      _isVisible = true;
      _isPersistent = true;
      _hostElement.setAttribute("aria-hidden", "false");
    },

    dismiss,

    get isVisible() {
      return _isVisible;
    },

    get shadowRoot() {
      return _shadowRoot;
    },

    get container() {
      return _container;
    },

    injectElement(el) {
      createHost();
      _shadowRoot.appendChild(el);
    },

    removeElement(el) {
      if (_shadowRoot && el && el.parentNode === _shadowRoot) {
        _shadowRoot.removeChild(el);
      }
    },

    positionNearSelection,

    destroy() {
      dismiss();
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      if (_hostElement && _hostElement.parentNode) {
        _hostElement.parentNode.removeChild(_hostElement);
      }
      _hostElement = null;
      _shadowRoot = null;
      _container = null;
    },
  };
})();
