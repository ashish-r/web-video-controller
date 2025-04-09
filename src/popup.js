// Get DOM elements
const siteToggle = document.getElementById('site-toggle');
const toggleStatus = document.getElementById('toggle-status');
const currentHostnameEl = document.getElementById('current-hostname');
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
const speedPresets = document.querySelectorAll('.speed-preset');

let currentHostname = '';

// Initialize the popup
function initPopup() {
  // Get current site status
  chrome.runtime.sendMessage({ action: 'getCurrentSiteStatus' }, (response) => {
    // If we don't have a valid hostname, disable the controls
    if (!response?.hostname) {
      siteToggle.disabled = true;
      speedSlider.disabled = true;
      speedPresets.forEach(btn => btn.disabled = true);
      toggleStatus.textContent = 'Not available on this page';
      return;
    }
    
    // Update hostname display
    currentHostname = response.hostname;
    currentHostnameEl.textContent = currentHostname;
    
    handleDisableChange(response.disabled);
    updateSpeedPresetButtons(response.speed);

    // Add listener for chrome.storage.local changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      // Only proceed if this is from local storage
      if (namespace !== 'local') return;
      
      // Check if disabledSites has changed
      if (changes.disabledSites) {
        const newDisabledSites = changes.disabledSites.newValue || [];
        const isCurrentSiteDisabled = newDisabledSites.includes(currentHostname);
        handleDisableChange(isCurrentSiteDisabled);
      }
      
      // Check if speed setting for current hostname has changed
      const speedKey = `speed_${currentHostname}`;
      if (changes[speedKey]) {
        updateSpeedPresetButtons(changes[speedKey].newValue || 1.0);
      }
    });
  });
}

function handleDisableChange (isDisabled) {
  siteToggle.checked = !isDisabled;
  // Update UI
  toggleStatus.textContent = isDisabled ? 'Disabled' : 'Enabled';
  
  // Enable/disable speed controls based on toggle state
  speedSlider.disabled = isDisabled;
  speedPresets.forEach(btn => btn.disabled = isDisabled);
  
  if (isDisabled) {
    speedSlider.classList.add('disabled');
    speedPresets.forEach(btn => btn.classList.add('disabled'));
  } else {
    speedSlider.classList.remove('disabled');
    speedPresets.forEach(btn => btn.classList.remove('disabled'));
  }
}

// Toggle site status
siteToggle.addEventListener('change', () => {
  const isEnabled = siteToggle.checked;
  handleDisableChange(!isEnabled)
  
  
  chrome.storage.local.get(['disabledSites'], (result) => {
    const disabledSites = result.disabledSites || [];
    
    if (isEnabled) {
      // Enable site
      if (disabledSites.includes(currentHostname)) {
        disabledSites.splice(disabledSites.indexOf(currentHostname), 1);
      }
    } else if (!disabledSites.includes(currentHostname)) {
      disabledSites.push(currentHostname);
    }
    
    // Save updated disabled sites list
    chrome.storage.local.set({ disabledSites: disabledSites });
  });
});

// Handle speed slider changes
speedSlider.addEventListener('input', () => {
  const newSpeed = parseFloat(speedSlider.value);
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
    updateSpeedPresetButtons(presetSpeed);
    setPlaybackSpeed(presetSpeed);
  });
});

// Set playback speed
function setPlaybackSpeed(speed) {
  
  chrome.storage.local.set({ [`speed_${currentHostname}`]: speed });
}

// Update speed preset buttons
function updateSpeedPresetButtons(speed) {
  speedValue.textContent = `${speed.toFixed(1)}x`;
  speedSlider.value = speed;
  speedPresets.forEach(btn => {
    const presetSpeed = parseFloat(btn.dataset.speed);
    if (presetSpeed === speed) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', initPopup);