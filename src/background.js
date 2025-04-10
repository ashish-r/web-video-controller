// Background script for Video Controls Extension
const extension = typeof browser !== "undefined" ? browser : chrome;
// Initialize storage if needed
extension.runtime.onInstalled.addListener(() => {
  extension.storage.local.get(['disabledSites'], (result) => {
    if (!result.disabledSites) {
      extension.storage.local.set({ disabledSites: [] });
    }
  });
});

// Listen for messages from popup or content script
extension.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getCurrentSiteStatus') {
    // Get current tab information
    extension.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        sendResponse({ disabled: false, speed: 1.0 });
        return;
      }
      
      const currentTab = tabs[0];
      const url = new URL(currentTab.url);
      const hostname = url.hostname;
      
      // Get disabled sites and speed from storage
      extension.storage.local.get(['disabledSites', `speed_${hostname}`], (result) => {
        const disabledSites = result.disabledSites || [];
        const isDisabled = disabledSites.includes(hostname);
        const speed = result[`speed_${hostname}`] || 1.0;
        
        sendResponse({ 
          disabled: isDisabled, 
          hostname: hostname,
          speed: speed
        });
      });
    });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
});