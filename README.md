# Kameleoon Installation Checker

This is a utility for quickly checking common installation failures for the Kameleoon.js snippet and verifying which script (engine.js or kameleoon.js) is being used.

## Features

- **Installation Checker**: Verifies engine.js presence, configuration, anti-flicker snippet setup, iframe configuration, and script loading order.
- **Engine Checker**: Scans a list of URLs to detect if they use `engine.js` or `kameleoon.js`.
- **CSP Detection**: Identifies Content Security Policy (CSP) issues that block `eval()`.
- **Dynamic Content Support**: Handles dynamically rendered sites (React, Next.js, Vue, etc.) by waiting for scripts to be injected.
- **Interactive Manual Checks**: Guided manual verification for advanced diagnostics (CORS, Consent Management, SPA mode).
- **Performance Metrics**: Measures script fetch and download timings.

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### Installation

```shell
npm install
```

## Usage

### 🦎 Installation Checker

Verifies the Kameleoon installation on a single URL.

```shell
node src/installation-checker/installation-checker.mjs <url> [username] [password]
```

**Example:**
```shell
node src/installation-checker/installation-checker.mjs https://www.kameleoon.com
```

### 🔍 Engine Checker

Checks multiple URLs from a JSON file to see which version of the script is loaded.

```shell
npm run check-engine
```

*By default, it uses `urls.example.json`. You can also specify a custom file:*

```shell
node src/engine-checker/engine-checker.mjs path/to/your-urls.json
```

## Support for HTTP Basic Auth

Both checkers support HTTP Basic Authentication for staging sites via command line arguments or environment variables:

- `STAGING_USERNAME`
- `STAGING_PASSWORD`

## Troubleshooting & Bot Detection

Some sites may detect Puppeteer as a bot and serve different content. If you see warnings about missing scripts or bot detection:

1. **Verify manually** in Chrome DevTools to confirm the installation.
2. The script uses stealth settings, but advanced bot detection may still block it.
3. For bot-protected sites, interactive manual checks in a real browser are recommended.
