chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'run_clean_check') {
    // 1. Get current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ success: false, error: 'No active tab found' });
        return;
      }
      
      const tab = tabs[0];
      const url = new URL(tab.url);
      
      // We can't clear browsing data for chrome:// or file:// URLs
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        sendResponse({ success: false, error: 'Cannot check this URL type' });
        return;
      }

      const origin = url.origin;
      
      // 2. Set the flag in storage so the content script knows to run on reload
      chrome.storage.local.get(['itpWorkarounds'], (data) => {
        const itpWorkarounds = data.itpWorkarounds || {};
        delete itpWorkarounds[origin]; // Reset for this origin
        
        chrome.storage.local.set({ 
          pendingCheck: origin, 
          checkTimestamp: Date.now(),
          itpWorkarounds 
        }, () => {
          // 3. Clear browsing data for this origin
          clearSiteData(origin, () => {
            // 4. Reload the tab
            chrome.tabs.reload(tab.id, { bypassCache: true }, () => {
              sendResponse({ success: true });
            });
          });
        });
      });
    });
    
    // Return true to indicate we will send response asynchronously
    return true; 
  }
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
    if (!details.responseHeaders) return;

    const setCookieHeaders = details.responseHeaders.filter(h => h.name.toLowerCase() === 'set-cookie');
    const hasKameleoonVisitorCode = setCookieHeaders.some(h => h.value.includes('kameleoonVisitorCode'));
    
    if (hasKameleoonVisitorCode && details.tabId >= 0) {
      // Key by the TAB's page origin, not the request origin.
      // This ensures cross-origin API requests (e.g. api.site.com) are attributed
      // to the page origin (e.g. shop.site.com) that the content script can look up.
      chrome.tabs.get(details.tabId, (tab) => {
        if (chrome.runtime.lastError || !tab || !tab.url) return;
        try {
          const pageOrigin = new URL(tab.url).origin;
          chrome.storage.local.get(['itpWorkarounds'], (data) => {
            const itpWorkarounds = data.itpWorkarounds || {};
            if (!itpWorkarounds[pageOrigin] || !Array.isArray(itpWorkarounds[pageOrigin].detections)) {
              itpWorkarounds[pageOrigin] = { detections: [] };
            }
            
            itpWorkarounds[pageOrigin].detections.push({
              type: details.type,
              timestamp: Date.now(),
              requestUrl: details.url
            });
            
            chrome.storage.local.set({ itpWorkarounds });
          });
        } catch (e) {
          console.error('Kameleoon Checker: Error parsing tab URL in webRequest', e);
        }
      });
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders", "extraHeaders"]
);
