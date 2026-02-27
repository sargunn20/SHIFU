const OpenAIProvider = (() => {
  const API_URL = "https://api.openai.com/v1/chat/completions";
  const DEFAULT_MODEL = "gpt-4o-mini";

  async function* streamChat(messages, config) {
    const model = config.model || DEFAULT_MODEL;

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 1024,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      let msg = `OpenAI API error (${response.status})`;
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
          if (data === "[DONE]") {
            yield { text: "", done: true, error: null };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              yield { text: delta, done: false, error: null };
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
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: imageDataUrl,
              detail: "low",
            },
          },
        ],
      },
    ];

    const visionModel = config.model || "gpt-4o-mini";
    yield* streamChat(messages, { ...config, model: visionModel });
  }

  const provider = { streamChat, streamVision };

  if (typeof AIRouter !== "undefined") {
    AIRouter.registerProvider("openai", provider);
  }

  return provider;
})();
