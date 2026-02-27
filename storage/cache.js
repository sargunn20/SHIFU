const Cache = (() => {
  const STORAGE_KEY = "sl_cache";
  const MAX_ENTRIES = 100;

  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) & 0xffffffff;
    }
    return h.toString(36);
  }

  function makeKey(text, mode, provider) {
    return hash(`${provider}:${mode}:${text.substring(0, 200)}`);
  }

  async function load() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (data) => {
        resolve(data[STORAGE_KEY] || { entries: {}, order: [] });
      });
    });
  }

  async function save(cache) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: cache }, resolve);
    });
  }

  return {
    async get(text, mode, provider) {
      const key = makeKey(text, mode, provider);
      const cache = await load();
      const entry = cache.entries[key];

      if (!entry) return null;

      cache.order = cache.order.filter((k) => k !== key);
      cache.order.push(key);
      await save(cache);

      return entry.text;
    },

    async set(text, mode, provider, explanation) {
      const key = makeKey(text, mode, provider);
      const cache = await load();

      cache.order = cache.order.filter((k) => k !== key);

      while (cache.order.length >= MAX_ENTRIES) {
        const oldestKey = cache.order.shift();
        delete cache.entries[oldestKey];
      }

      cache.entries[key] = {
        text: explanation,
        timestamp: Date.now(),
      };
      cache.order.push(key);

      await save(cache);
    },

    async clear() {
      await save({ entries: {}, order: [] });
    },

    async stats() {
      const cache = await load();
      const count = cache.order.length;
      let oldestAge = 0;

      if (count > 0) {
        const oldestKey = cache.order[0];
        const oldest = cache.entries[oldestKey];
        if (oldest) oldestAge = Date.now() - oldest.timestamp;
      }

      return { count, oldestAge };
    },
  };
})();
