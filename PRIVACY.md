# Privacy Policy — A/B check for Kameleoon (Unofficial)

Last updated: 2026-10-08

A/B check for Kameleoon (Unofficial) is a Chrome extension that checks whether the Kameleoon snippet is correctly installed and configured on the current webpage (script loading, anti-flicker snippet, CSP headers, execution permissions, load performance).

## What the extension does

- Reads the DOM, response headers, and network activity of the page you are currently viewing, to detect Kameleoon-related scripts, domains, and configuration.
- Stores check results locally in your browser (`chrome.storage.local`), scoped per tab, so results persist across a page reload triggered by the extension.

## What the extension does not do

- It does not collect, transmit, or sell any personal data, browsing history, or page content to Kameleoon, the developer, or any third party.
- It does not use analytics, tracking, or advertising services.
- All processing happens locally in your browser. No data ever leaves your device.

## Permissions

- `tabs`: to find the active tab, reload it for the check, and clean up per-tab state when the tab is closed.
- `webRequest`: read-only listener on response headers, used only to check Set-Cookie headers for the `kameleoonVisitorCode` cookie (Kameleoon's ITP workaround). Requests are never blocked or modified, and results are stored locally per tab.
- `storage`: to save check results locally between the check and the popup displaying them.
- `browsingData`: used only to clear the tested site's cache, cookies, and site storage (local storage, IndexedDB, service workers) right before the check reloads the page, so results reflect a first visit. Limited to that one origin; no other site's data is touched.
- Host permissions (`<all_urls>`): required because the extension must be able to run its check on any site the user chooses to test.

## Contact

Questions about this policy can be sent to pgueripel@kameleoon.com.
