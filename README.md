# A/B check for Kameleoon (Unofficial) — Chrome Extension

An aesthetic, powerful Chrome extension designed to automatically test and validate Kameleoon script deployments directly in the browser.

## Features
- **Auto-Detection**: Automatically detects if `engine.js` or `kameleoon.js` is loaded on the current page.
- **Deep Diagnostic**: Performs comprehensive checks including:
    - **CSP Header Analysis**: Checks if Content Security Policy allows Kameleoon domains.
    - **Anti-Flicker Snipet Validation**: Verifies the presence and correctness of the anti-flicker snippet.
    - **Execution Permissions**: Checks if `eval()` and other necessary permissions are enabled.
    - **Performance Tracking**: Measures how quickly the Kameleoon script loads.
- **Visual Feedback**: Clean, premium popup interface with pass/fail indicators and debug information.

## Installation (Development Mode)

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the root directory of this project.

## Usage

1. Navigate to any website you want to test.
2. Click the Kameleoon icon in your Chrome extensions bar.
3. Click "Run Installation Check".
4. The extension will refresh the page and perform a series of tests, presenting the results in the popup.

## Technical Details

- **manifest.json**: Extension configuration (V3).
- **background.js**: Manages messaging and state preservation during page reloads.
- **content.js**: Executes DOM-based tests on the target website.
- **inject.js**: Injected into the page to access the global `Kameleoon` object.
- **popup.html/css/js**: The user interface for the extension.
