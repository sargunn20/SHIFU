const ClaudeProvider = (() => {
  const API_URL = "https://api.anthropic.com/v1/messages";
  const DEFAULT_MODEL = "claude-sonnet-4-20250514";
  const API_VERSION = "2023-06-01";

  function formatMessages(messages) {
    let system;
    const formatted = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        system = msg.content;
        continue;
      }

      formatted.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      });
    }

    return { system, messages: formatted };
  }

  async function* streamChat(messages, config) {
    const model = config.model || DEFAULT_MODEL;
    const { system, messages: formatted } = formatMessages(messages);

    const body = {
      model,
      messages: formatted,
      max_tokens: config.maxTokens ?? 1024,
      temperature: config.temperature ?? 0.7,
      stream: true,
    };

    if (system) body.system = system;

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      let msg = `Claude API error (${response.status})`;
      try {
        const parsed = JSON.parse(err);
        msg = parsed.error?.message || msg;
      } catch {}
      yield { text: "", done: true, error: msg };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);

          try {
            const parsed = JSON.parse(data);

            switch (parsed.type) {
              case "content_block_delta":
                if (parsed.delta?.type === "text_delta") {
                  yield { text: parsed.delta.text, done: false, error: null };
                }
                break;

              case "message_stop":
                yield { text: "", done: true, error: null };
                return;

              case "error":
                yield {
                  text: "",
                  done: true,
                  error: parsed.error?.message || "Unknown error",
                };
                return;
            }
          } catch {}
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { text: "", done: true, error: null };
  }

  async function* streamVision(imageDataUrl, prompt, config) {
    const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      yield { text: "", done: true, error: "Invalid image data format." };
      return;
    }

    const [, mediaType, base64Data] = match;

    const messages = [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ];

    const visionModel = config.model || "claude-sonnet-4-20250514";

    yield* streamChat(messages, { ...config, model: visionModel });
  }

  const provider = { streamChat, streamVision };

  if (typeof AIRouter !== "undefined") {
    AIRouter.registerProvider("claude", provider);
  }

  return provider;
})();
