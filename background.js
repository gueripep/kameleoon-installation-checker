chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'run_clean_check') {
    // 1. Get current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ success: false, error: 'No active tab found' });
        return;
      }
      
      const tab = tabs[0];
      const tabId = tab.id;
      const url = new URL(tab.url);
      
      // We can't clear browsing data for chrome:// or file:// URLs
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        sendResponse({ success: false, error: 'Cannot check this URL type' });
        return;
      }

      const origin = url.origin;
      
      // 2. Set the flags in storage
      const storageUpdate = {};
      storageUpdate[`pending_${tabId}`] = origin;
      storageUpdate[`timestamp_${tabId}`] = Date.now();
      
      // Clear previous results and detections for this tab
      const keysToRemove = [
        `results_${tabId}`,
        `itpWorkaround_${tabId}`
      ];

      chrome.storage.local.remove(keysToRemove, () => {
        chrome.storage.local.set(storageUpdate, () => {
          // 3. Clear browsing data for this origin
          clearSiteData(origin, () => {
            // 4. Reload the tab
            chrome.tabs.reload(tabId, { bypassCache: true }, () => {
              sendResponse({ success: true });
            });
          });
        });
      });
    });
    
    // Return true to indicate we will send response asynchronously
    return true; 
  }

  if (message.action === 'save_results') {
    const tabId = sender.tab.id;
    const results = message.results;
    const storageUpdate = {};
    storageUpdate[`results_${tabId}`] = results;

    if (message.isFinal) {
      // Only a genuine Kameleoon detection clears the pending status. An
      // interim/fallback save (e.g. "not found yet") must leave it in place —
      // otherwise a same-origin navigation afterwards (like a Shopify
      // password-gate page redirecting to the real store once unlocked)
      // won't get re-checked, and the stale "not found" report sticks around
      // forever even though Kameleoon is present on the page you land on.
      chrome.storage.local.remove([`pending_${tabId}`, `timestamp_${tabId}`], () => {
          chrome.storage.local.set(storageUpdate);
      });
    } else {
      chrome.storage.local.set(storageUpdate);
    }
  }

  if (message.action === 'get_tab_status') {
      const tabId = sender.tab.id;
      const itpKey = `itpWorkaround_${tabId}`;
      chrome.storage.local.get([`pending_${tabId}`, `timestamp_${tabId}`, itpKey], (data) => {
          sendResponse({
              tabId: tabId,
              pending: data[`pending_${tabId}`],
              timestamp: data[`timestamp_${tabId}`],
              itpData: data[itpKey]
          });
      });
      return true;
  }
});

// Clean up tab-specific data when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.remove([
        `results_${tabId}`,
        `pending_${tabId}`,
        `timestamp_${tabId}`,
        `itpWorkaround_${tabId}`
    ]);
});

function clearSiteData(origin, callback) {
  // BrowsingData API requires host permissions or activeTab. We clear cookies, cache, local storage.
  chrome.browsingData.remove({
    "origins": [origin]
  }, {
    "cacheStorage": true,
    "cookies": true,
    "fileSystems": true,
    "indexedDB": true,
    "localStorage": true,
    "serviceWorkers": true,
    "webSQL": true
  }, callback);
}

// Listen for response headers to detect ITP workaround (Set-Cookie for kameleoonVisitorCode)
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!details.responseHeaders || details.tabId < 0) return;

    const setCookieHeaders = details.responseHeaders.filter(h => h.name.toLowerCase() === 'set-cookie');
    const hasKameleoonVisitorCode = setCookieHeaders.some(h => h.value.includes('kameleoonVisitorCode'));
    
    const itpKey = `itpWorkaround_${details.tabId}`;

    // If it's a main frame request, we always prepare to reset the detections for this tab
    // because it's a new page load.
    if (details.type === 'main_frame') {
      chrome.storage.local.remove(itpKey, () => {
        if (hasKameleoonVisitorCode) {
          saveDetection(details);
        }
      });
    } else if (hasKameleoonVisitorCode) {
      saveDetection(details);
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders", "extraHeaders"]
);

function saveDetection(details) {
  const itpKey = `itpWorkaround_${details.tabId}`;
  chrome.storage.local.get([itpKey], (data) => {
    const detections = data[itpKey] || [];
    detections.push({
      type: details.type,
      timestamp: Date.now(),
      requestUrl: details.url
    });
    
    const update = {};
    update[itpKey] = detections;
    chrome.storage.local.set(update);
  });
}

