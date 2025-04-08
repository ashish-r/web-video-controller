// Background script for Video Controls Extension

// Initialize storage if needed
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['disabledSites', 'defaultSpeed'], (result) => {
    if (!result.disabledSites) {
      chrome.storage.local.set({ disabledSites: [] });
    }
    if (!result.defaultSpeed) {
      chrome.storage.local.set({ defaultSpeed: 1.0 });
    }
  });
});

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getCurrentSiteStatus') {
    // Get current tab information
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        sendResponse({ disabled: false, speed: 1.0 });
        return;
      }
      
      const currentTab = tabs[0];
      const url = new URL(currentTab.url);
      const hostname = url.hostname;
      
      // Get disabled sites and speed from storage
      chrome.storage.local.get(['disabledSites', `speed_${hostname}`], (result) => {
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
  
  if (message.action === 'setPlaybackSpeed') {
    // Send message to content script to update speed
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;
      
      chrome.tabs.sendMessage(
        tabs[0].id,
        { 
          action: 'updatePlaybackSpeed', 
          speed: message.speed 
        }
      );
      
      // Store speed for current site
      chrome.storage.local.set({ [`speed_${message.hostname}`]: message.speed });
      
      sendResponse({ success: true });
    });
    
    return true;
  }
});