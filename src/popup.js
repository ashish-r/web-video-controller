// Get DOM elements
const siteToggle = document.getElementById('site-toggle');
const toggleStatus = document.getElementById('toggle-status');
const currentHostnameEl = document.getElementById('current-hostname');
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
const speedPresets = document.querySelectorAll('.speed-preset');

let currentHostname = '';
let currentSpeed = 1.0;

// Initialize the popup
function initPopup() {
  // Get current site status
  chrome.runtime.sendMessage({ action: 'getCurrentSiteStatus' }, (response) => {
    if (!response) return;
    
    // Update hostname display
    currentHostname = response.hostname || 'Not available';
    currentHostnameEl.textContent = currentHostname;
    
    // Update toggle state
    siteToggle.checked = !response.disabled;
    toggleStatus.textContent = response.disabled ? 'Disabled' : 'Enabled';
    
    // Update speed slider
    currentSpeed = response.speed;
    speedSlider.value = currentSpeed;
    speedValue.textContent = `${currentSpeed.toFixed(1)}x`;
    
    // Update speed preset buttons
    updateSpeedPresetButtons();
    
    // Enable/disable speed controls based on toggle state
    const isEnabled = !response.disabled;
    speedSlider.disabled = !isEnabled;
    speedPresets.forEach(btn => btn.disabled = !isEnabled);
    
    if (!isEnabled) {
      speedSlider.classList.add('disabled');
      speedPresets.forEach(btn => btn.classList.add('disabled'));
    } else {
      speedSlider.classList.remove('disabled');
      speedPresets.forEach(btn => btn.classList.remove('disabled'));
    }
    
    // If we don't have a valid hostname, disable the controls
    if (!response.hostname) {
      siteToggle.disabled = true;
      speedSlider.disabled = true;
      speedPresets.forEach(btn => btn.disabled = true);
      toggleStatus.textContent = 'Not available on this page';
    }
  });
}

// Toggle site status
siteToggle.addEventListener('change', () => {
  const isEnabled = siteToggle.checked;
  
  // Update UI
  toggleStatus.textContent = isEnabled ? 'Enabled' : 'Disabled';
  
  // Enable/disable speed controls based on toggle state
  speedSlider.disabled = !isEnabled;
  speedPresets.forEach(btn => btn.disabled = !isEnabled);
  
  if (!isEnabled) {
    speedSlider.classList.add('disabled');
    speedPresets.forEach(btn => btn.classList.add('disabled'));
  } else {
    speedSlider.classList.remove('disabled');
    speedPresets.forEach(btn => btn.classList.remove('disabled'));
  }
  
  // Send message to content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: 'toggleSiteDisabled', disabled: !isEnabled },
        (response) => {
          // Handle response
          console.log('Toggle response:', response);
          
          // If no response, it could be that the content script isn't loaded yet
          if (chrome.runtime.lastError) {
            console.log('Error:', chrome.runtime.lastError);
            // Update the storage directly in case content script isn't loaded
            chrome.runtime.sendMessage({ 
              action: 'getCurrentSiteStatus'
            }, (statusResponse) => {
              if (statusResponse && statusResponse.hostname) {
                chrome.storage.local.get('disabledSites', (result) => {
                  let disabledSites = result.disabledSites || [];
                  
                  if (!isEnabled && !disabledSites.includes(statusResponse.hostname)) {
                    disabledSites.push(statusResponse.hostname);
                  } else if (isEnabled) {
                    disabledSites = disabledSites.filter(site => site !== statusResponse.hostname);
                  }
                  
                  chrome.storage.local.set({ disabledSites });
                });
              }
            });
          }
        }
      );
    }
  });
});

// Handle speed slider changes
speedSlider.addEventListener('input', () => {
  const newSpeed = parseFloat(speedSlider.value);
  speedValue.textContent = `${newSpeed.toFixed(1)}x`;
  updateSpeedPresetButtons(newSpeed);
});

speedSlider.addEventListener('change', () => {
  const newSpeed = parseFloat(speedSlider.value);
  setPlaybackSpeed(newSpeed);
});

// Handle speed preset button clicks
speedPresets.forEach(btn => {
  btn.addEventListener('click', () => {
    const presetSpeed = parseFloat(btn.dataset.speed);
    speedSlider.value = presetSpeed;
    speedValue.textContent = `${presetSpeed.toFixed(2)}x`;
    updateSpeedPresetButtons(presetSpeed);
    setPlaybackSpeed(presetSpeed);
  });
});

// Set playback speed
function setPlaybackSpeed(speed) {
  currentSpeed = speed;
  
  // Send message to update speed
  chrome.runtime.sendMessage({
    action: 'setPlaybackSpeed',
    hostname: currentHostname,
    speed: speed
  }, (response) => {
    // Handle response if needed
    console.log('Speed update response:', response);
  });
}

// Update speed preset buttons
function updateSpeedPresetButtons(speed) {
  speed = speed || currentSpeed;
  
  speedPresets.forEach(btn => {
    const presetSpeed = parseFloat(btn.dataset.speed);
    if (presetSpeed === speed) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Listen for speed changes from content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'speedChanged' && message.hostname === currentHostname) {
    currentSpeed = message.speed;
    speedSlider.value = currentSpeed;
    speedValue.textContent = `${currentSpeed.toFixed(2)}x`;
    updateSpeedPresetButtons();
  }
});

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', initPopup);