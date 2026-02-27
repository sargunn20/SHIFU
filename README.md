# Shifu AI Study Assistant

Shifu is a smart AI study assistant browser extension that helps you instantly understand and take notes from text, videos, and images with smart context.

## Features
* Explain selected text across any web page.
* Explain visible page content via screenshots.
* Take smart notes on YouTube videos.
* Manage highlights and notes directly in the browser through a sliding panel.
* Works with OpenAI, Google Gemini, Anthropic Claude, and Groq APIs.

## Dependencies
Since this is a vanilla browser extension, there are no external package dependencies (like npm modules) needed to build it. It runs entirely in the browser! However, you will need to provide your own API keys to use the AI features:
* OpenAI API Key
* Google Gemini API Key
* Anthropic Claude API Key
* Groq API Key

## Setup Instructions
To install and start using Shifu locally, follow these simple steps:

1. **Clone the repository**
   Open your terminal and run:
   ```bash
   git clone https://github.com/sargunn20/SHIFU.git
   ```

2. **Load the extension into your browser**
   * If you're using Chrome, Brave, or Edge, go to the extensions page (e.g., `chrome://extensions`).
   * Turn on "Developer mode" in the top right corner.
   * Click the "Load unpacked" button.
   * Select the folder where you cloned the repository.

3. **Configure your API Keys**
   * Click on the Shifu extension icon in your browser toolbar to open the popup.
   * Go to the settings tab to enter and save your preferred API keys. You only need to add the keys for the providers you want to use.

4. **Start learning!**
   * Select text, use keyboard shortcuts, or open the notes panel to start interacting with Shifu on any webpage.

## Keyboard Shortcuts
* `Ctrl+Shift+E` (Mac: `Cmd+Shift+E`): Explain selected text
* `Ctrl+Shift+L` (Mac: `Cmd+Shift+L`): Explain visible page screenshot
* `Ctrl+Shift+Y` (Mac: `Cmd+Shift+Y`): Toggle YouTube notes panel
* `Ctrl+Shift+N` (Mac: `Cmd+Shift+N`): Toggle highlights and notes panel
