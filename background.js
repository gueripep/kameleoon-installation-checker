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
      chrome.storage.local.set({ pendingCheck: origin, checkTimestamp: Date.now() }, () => {
        
        // 3. Clear browsing data for this origin
        clearSiteData(origin, () => {
          // 4. Reload the tab
          chrome.tabs.reload(tab.id, { bypassCache: true }, () => {
            sendResponse({ success: true });
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
