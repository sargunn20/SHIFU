const Explain = (() => {
  let _activeController = null;

  const MODES = {
    eli5: {
      label: "ELI5",
      prompt:
        "Explain this like I'm 5 years old. Use simple words and fun analogies.",
    },
    student: {
      label: "Student",
      prompt:
        "Explain this at a university student level. Be clear and educational.",
    },
    expert: {
      label: "Expert",
      prompt:
        "Explain this at an expert/professional level. Be precise and technical.",
    },
    bullet: {
      label: "Bullets",
      prompt:
        "Summarize this in concise bullet points. Focus on key takeaways.",
    },
    example: {
      label: "Examples",
      prompt: "Explain this concept using practical real-world examples.",
    },
  };

  function buildSystemPrompt(pageContext, surrounding) {
    let prompt = `You are a helpful study assistant explaining content from a webpage. Be concise and clear. Format with markdown when helpful.`;

    if (pageContext?.topic) {
      prompt += `\n\nPage topic: ${pageContext.topic}`;
    }

    if (surrounding) {
      prompt += `\n\nSurrounding context: "${surrounding.substring(0, 400)}"`;
    }

    return prompt;
  }

  function buildUserPrompt(selectedText, modeId) {
    const mode = MODES[modeId] || MODES.student;
    let prompt = `${mode.prompt}\n\nSelected text:\n"${selectedText}"`;
    return prompt;
  }

  return {
    MODES,

    async run(selectionData, modeId, onChunk, onDone, onError) {
      if (_activeController) {
        _activeController.abort();
      }
      _activeController = new AbortController();

      const mode = modeId || "student";

      try {
        const config = await AIRouter.getProviderConfig();
        const cached = await Cache.get(
          selectionData.text,
          mode,
          config.provider,
        );
        if (cached) {
          onChunk(cached);
          onDone(cached);
          return;
        }

        const pageContext = Context.extract();

        const messages = [
          {
            role: "system",
            content: buildSystemPrompt(
              pageContext,
              selectionData.surroundingParagraph,
            ),
          },
          { role: "user", content: buildUserPrompt(selectionData.text, mode) },
        ];

        let fullText = "";
        for await (const chunk of AIRouter.streamChat(messages)) {
          if (_activeController.signal.aborted) return;

          if (chunk.error) {
            onError(chunk.error);
            return;
          }

          fullText += chunk.text;
          onChunk(chunk.text);

          if (chunk.done) break;
        }

        if (fullText) {
          await Cache.set(selectionData.text, mode, config.provider, fullText);
        }

        onDone(fullText);
      } catch (err) {
        if (err.name !== "AbortError") {
          onError(err.message);
        }
      }
    },

    cancel() {
      if (_activeController) {
        _activeController.abort();
        _activeController = null;
      }
    },
  };
})();
