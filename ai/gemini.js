const GeminiProvider = (() => {
  const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
  const DEFAULT_MODEL = "gemini-2.0-flash";

  function formatMessages(messages) {
    let systemInstruction = null;
    const contents = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction = { parts: [{ text: msg.content }] };
        continue;
      }

      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts:
          typeof msg.content === "string"
            ? [{ text: msg.content }]
            : msg.content,
      });
    }

    return { contents, systemInstruction };
  }

  async function* streamChat(messages, config) {
    const model = config.model || DEFAULT_MODEL;
    const { contents, systemInstruction } = formatMessages(messages);

    const url = `${API_BASE}/${model}:streamGenerateContent?alt=sse&key=${config.apiKey}`;

    const body = {
      contents,
      generationConfig: {
        temperature: config.temperature ?? 0.7,
        maxOutputTokens: config.maxTokens ?? 1024,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      let msg = `Gemini API error (${response.status})`;
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
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              yield { text, done: false, error: null };
            }

            const finishReason = parsed.candidates?.[0]?.finishReason;
            if (finishReason && finishReason !== "STOP") {
              if (finishReason === "SAFETY") {
                yield {
                  text: "",
                  done: true,
                  error: "Response blocked by safety filters.",
                };
                return;
              }
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

    const [, mimeType, base64Data] = match;

    const messages = [
      {
        role: "user",
        content: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ];

    const visionModel = config.model || "gemini-2.0-flash";
    yield* streamChat(messages, { ...config, model: visionModel });
  }

  const provider = { streamChat, streamVision };

  if (typeof AIRouter !== "undefined") {
    AIRouter.registerProvider("gemini", provider);
  }

  return provider;
})();
