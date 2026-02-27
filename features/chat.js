const Chat = (() => {
  let _history = [];
  let _context = null;
  let _activeController = null;

  function init(context) {
    _context = context;
    _history = [
      {
        role: "system",
        content: buildSystemPrompt(context),
      },
      {
        role: "user",
        content: `Explain this:\n"${context.selectedText}"`,
      },
      {
        role: "assistant",
        content: context.explanation,
      },
    ];
  }

  function buildSystemPrompt(ctx) {
    let prompt = `You are a helpful study assistant. The user highlighted text on a webpage and received an explanation. Now they have follow-up questions. Be concise and helpful.`;

    if (ctx.pageTopic) {
      prompt += `\n\nPage topic: ${ctx.pageTopic}`;
    }
    if (ctx.surroundingParagraph) {
      prompt += `\n\nSurrounding paragraph: "${ctx.surroundingParagraph.substring(0, 400)}"`;
    }

    return prompt;
  }

  return {
    init,

    async send(message, onChunk, onDone, onError) {
      if (_activeController) _activeController.abort();
      _activeController = new AbortController();

      _history.push({ role: "user", content: message });

      try {
        let fullResponse = "";
        for await (const chunk of AIRouter.streamChat(_history)) {
          if (_activeController.signal.aborted) return;

          if (chunk.error) {
            onError(chunk.error);
            return;
          }

          fullResponse += chunk.text;
          onChunk(chunk.text);

          if (chunk.done) break;
        }

        _history.push({ role: "assistant", content: fullResponse });

        if (_history.length > 22) {
          _history = [_history[0], ..._history.slice(-20)];
        }

        onDone(fullResponse);
      } catch (err) {
        if (err.name !== "AbortError") {
          onError(err.message);
        }
      }
    },

    get history() {
      return _history;
    },

    clear() {
      _history = [];
      _context = null;
      if (_activeController) _activeController.abort();
    },

    cancel() {
      if (_activeController) {
        _activeController.abort();
        _activeController = null;
      }
    },
  };
})();
