# Privacy Policy — Kameleoon Installation Checker (Unofficial)

Last updated: 2026-07-22

Kameleoon Installation Checker (Unofficial) is a Chrome extension that checks whether the Kameleoon snippet is correctly installed and configured on the current webpage (script loading, anti-flicker snippet, CSP headers, execution permissions, load performance).

## What the extension does

- Reads the DOM, response headers, and network activity of the page you are currently viewing, to detect Kameleoon-related scripts, domains, and configuration.
- Stores check results locally in your browser (`chrome.storage.local`), scoped per tab, so results persist across a page reload triggered by the extension.

## What the extension does not do

- It does not collect, transmit, or sell any personal data, browsing history, or page content to Kameleoon, the developer, or any third party.
- It does not use analytics, tracking, or advertising services.
- All processing happens locally in your browser. No data ever leaves your device.

## Permissions

- `activeTab` / `tabs`: to run checks on the page you're currently viewing and manage per-tab state.
- `scripting`: to inject the diagnostic script that inspects the page.
- `webRequest`: to inspect response headers (e.g. Content-Security-Policy) relevant to the Kameleoon snippet.
- `storage`: to save check results locally between the check and the popup displaying them.
- `browsingData`: used only to clear cached data for the current site when re-running a check, so results reflect a clean reload.
- Host permissions (`<all_urls>`): required because the extension must be able to run its check on any site the user chooses to test.

## Contact

Questions about this policy can be sent to pgueripel@kameleoon.com.
