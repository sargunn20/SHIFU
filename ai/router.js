const AIRouter = (() => {
  const providers = {};

  function registerProvider(name, module) {
    providers[name] = module;
  }

  async function getProviderConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["aiProvider", "apiKey", "aiModel"], (data) => {
        const provider = data.aiProvider || "openai";
        const apiKey = data.apiKey || "";
        const model = data.aiModel || "";

        resolve({ provider, apiKey, model });
      });
    });
  }

  async function* streamChat(messages, options = {}) {
    const config = await getProviderConfig();

    if (!config.apiKey) {
      yield {
        text: "",
        done: true,
        error: "No API key configured. Click the Shifu icon to add your key.",
      };
      return;
    }

    const provider = providers[config.provider];
    if (!provider) {
      yield {
        text: "",
        done: true,
        error: `Unknown provider: ${config.provider}`,
      };
      return;
    }

    try {
      yield* provider.streamChat(messages, {
        apiKey: config.apiKey,
        model: config.model,
        ...options,
      });
    } catch (err) {
      yield { text: "", done: true, error: `AI Error: ${err.message}` };
    }
  }

  async function* streamVision(imageDataUrl, prompt, options = {}) {
    const config = await getProviderConfig();

    if (!config.apiKey) {
      yield {
        text: "",
        done: true,
        error: "No API key configured. Click the Shifu icon to add your key.",
      };
      return;
    }

    const provider = providers[config.provider];
    if (!provider) {
      yield {
        text: "",
        done: true,
        error: `Unknown provider: ${config.provider}`,
      };
      return;
    }

    if (!provider.streamVision) {
      yield {
        text: "",
        done: true,
        error: `${config.provider} does not support vision.`,
      };
      return;
    }

    try {
      yield* provider.streamVision(imageDataUrl, prompt, {
        apiKey: config.apiKey,
        model: config.model,
        ...options,
      });
    } catch (err) {
      yield { text: "", done: true, error: `Vision Error: ${err.message}` };
    }
  }

  async function chat(messages, options = {}) {
    let fullText = "";
    let lastError = null;

    for await (const chunk of streamChat(messages, options)) {
      if (chunk.error) {
        lastError = chunk.error;
        break;
      }
      fullText += chunk.text;
    }

    return { text: fullText, error: lastError };
  }

  return {
    registerProvider,
    streamChat,
    streamVision,
    chat,
    getProviderConfig,

    get availableProviders() {
      return Object.keys(providers);
    },
  };
})();
