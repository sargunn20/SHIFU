const ImageExplain = (() => {
  async function captureTab() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "CAPTURE_TAB" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response?.success) {
          resolve(response.dataUrl);
        } else {
          reject(new Error(response?.error || "Screenshot capture failed"));
        }
      });
    });
  }

  return {
    async run(imageDataUrl, onChunk, onDone, onError) {
      try {
        const image = imageDataUrl || (await captureTab());

        const pageContext = Context.extract();

        const prompt = `Analyze this screenshot from a webpage.
Page: ${pageContext.topic || pageContext.title || "Unknown"}

Describe what you see and explain any important content, diagrams, code, or data visible in the image. Be concise and educational.`;

        let fullText = "";
        for await (const chunk of AIRouter.streamVision(image, prompt)) {
          if (chunk.error) {
            onError(chunk.error);
            return;
          }

          fullText += chunk.text;
          onChunk(chunk.text);

          if (chunk.done) break;
        }

        onDone(fullText);
      } catch (err) {
        onError(err.message);
      }
    },
  };
})();
