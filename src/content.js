// Global variables
let disabledSites = [];
const currentHostname = window.location.hostname;
let activeVideos = []; // Track active videos for keyboard shortcuts

// Check if the current site is disabled
function isCurrentSiteDisabled() {
  return disabledSites.includes(currentHostname);
}

// Load disabled sites from storage
function loadDisabledSites() {
  chrome.storage.local.get('disabledSites', (result) => {
    disabledSites = result.disabledSites || [];
    
    // If site is not disabled, initialize the controller
    if (!isCurrentSiteDisabled()) {
      initializeVideoController();
      
      // Setup keyboard shortcuts
      setupKeyboardShortcuts();
    }
  });
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
  // Timers object to track pending actions
  const pendingActions = {};
  
  document.addEventListener('keydown', (e) => {
    // Don't process shortcuts if user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }
    
    // Find the most recently interacted with video or the first video
    const targetVideo = activeVideos.length > 0 ? activeVideos[0] : document.querySelector('video');
    
    if (!targetVideo) return;
    
    // Clear any existing timer for this key to prevent multiple actions
    if (pendingActions[e.key]) {
      clearTimeout(pendingActions[e.key]);
    }
    
    switch (e.key) {
      case '+': // Increase speed
      case '=': 
        e.preventDefault();
        const currentSpeedUp = targetVideo.playbackRate;
        
        pendingActions[e.key] = setTimeout(() => {
          // Only proceed if the playback rate hasn't changed
          if (targetVideo.playbackRate === currentSpeedUp) {
            let newSpeedUp = currentSpeedUp + 0.2;
            newSpeedUp = Math.round(newSpeedUp * 100) / 100;
            targetVideo.playbackRate = Math.min(5, newSpeedUp);
          }
          delete pendingActions[e.key];
        }, 200);
        break;
        
      case '-': // Decrease speed
        e.preventDefault();
        const currentSpeedDown = targetVideo.playbackRate;
        
        pendingActions[e.key] = setTimeout(() => {
          // Only proceed if the playback rate hasn't changed
          if (targetVideo.playbackRate === currentSpeedDown) {
            let newSpeedDown = currentSpeedDown - 0.1;
            newSpeedDown = Math.round(newSpeedDown * 100) / 100;
            targetVideo.playbackRate = Math.max(0.1, newSpeedDown);
          }
          delete pendingActions[e.key];
        }, 200);
        break;
        
      case 'p': // Play/Pause toggle
      case ' ': // Spacebar
        // Only prevent default if we're actually controlling a video
        // This prevents breaking normal spacebar functionality
        if (document.activeElement === document.body) {
          e.preventDefault();
          const isPaused = targetVideo.paused;
          
          pendingActions[e.key] = setTimeout(() => {
            // Only proceed if the paused state hasn't changed
            if (targetVideo.paused === isPaused) {
              if (isPaused) {
                targetVideo.play();
              } else {
                targetVideo.pause();
              }
            }
            delete pendingActions[e.key];
          }, 200);
        }
        break;
    }
  }, true);
}

// Initialize the video controller for each video on the page
function initializeVideoController() {
  // Find all video elements on the page
  const videos = document.querySelectorAll('video');
  
  videos.forEach((video) => {
    // Only add controller if video is visible and has dimensions
    if (video.offsetWidth > 0 && video.offsetHeight > 0) {
      createVideoController(video);
    }
  });
  
  // Watch for dynamically added videos
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        // Check if the added node is a video or contains videos
        if (node.nodeName === 'VIDEO') {
          createVideoController(node);
        } else if (node.querySelectorAll) {
          const newVideos = node.querySelectorAll('video');
          newVideos.forEach(createVideoController);
        }
      });
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

function setPlaybackSpeedAndUI(video) {
  // Get saved playback speed for this site
  let savedPlaybackSpeed = 1.0;
  chrome.storage.local.get(`speed_${currentHostname}`, (result) => {
    if (result[`speed_${currentHostname}`]) {
      savedPlaybackSpeed = result[`speed_${currentHostname}`];
      // Apply saved speed to the video after a short delay to ensure it loads
      setTimeout(() => {
        video.playbackRate = savedPlaybackSpeed;
        updateControllerStatus(video, shadowRoot.querySelector('.video-controller-nudge'), shadowRoot.querySelector('.play-pause'));
      }, 500);
    }
  });
}

// Create video controller UI
function createVideoController(video) {
  // Check if controller already exists for this video
  if (video.hasAttribute('data-controller-added')) {
    setPlaybackSpeedAndUI(video);
    return;
  }
  
  // Mark this video as having a controller
  video.setAttribute('data-controller-added', 'true');
  
  // Create shadow DOM container
  const shadowContainer = document.createElement('div');
  shadowContainer.className = 'video-controls-shadow-container';
  shadowContainer.style.cssText = 'all: initial !important; position: absolute; z-index: 9999; top: 10px; right: 10px;';
  
  // Create shadow root
  const shadowRoot = shadowContainer.attachShadow({ mode: 'closed' });
  
  setPlaybackSpeedAndUI(video);
  
  shadowRoot.innerHTML = `
    <style>
      :host {
        all: initial !important;
      }
      
      /* Video Controller Styles */
      .video-controller-container {
        position: absolute;
        z-index: 9999;
        font-family: Arial, sans-serif;
        font-size: 14px;
        user-select: none;
        transition: all 0.3s ease;
        right: 10px;
        top: 40px;
        transform: scale(0.5); /* Start at 0.5x scale when minimized */
        transform-origin: top right;
      }
      
      /* Scale up on hover */
      .video-controller-container.hovered {
        transform: scale(1);
      }
      
      /* Nudge styles */
      .video-controller-nudge {
        background: linear-gradient(135deg, #4361ee, #3a0ca3);
        color: white;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
        position: relative;
        border: 2px solid rgba(255, 255, 255, 0.8);
      }
      
      .video-controller-nudge:hover {
        transform: scale(1.05);
      }
      
      .status-icon {
        font-size: 12px;
        font-weight: bold;
      }
      
      /* Expanded controller styles */
      .video-controller-expanded {
        display: none;
        background: linear-gradient(135deg, #4361ee, #3a0ca3);
        border-radius: 20px;
        padding: 8px;
        position: absolute;
        top: 40px;
        right: 0;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.5);
      }
      
      .video-controller-expanded.visible {
        display: flex;
      }
      
      /* Button styles */
      .controller-btn {
        background-color: rgba(255, 255, 255, 0.15);
        color: white;
        border: none;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        margin: 0 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: bold;
      }
      
      .controller-btn:hover {
        background-color: rgba(255, 255, 255, 0.3);
      }
      
      .play-pause {
        font-size: 12px;
      }
      
      .speed-up, .speed-down {
        font-size: 14px;
      }
      
      .close {
        position: absolute;
        top: -8px;
        right: -8px;
        font-size: 12px;
        width: 20px;
        height: 20px;
        background-color: rgba(255, 255, 255, 0.9);
        color: #3a0ca3;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      }
      
      .close:hover {
        background-color: white;
        transform: scale(1.1);
      }
      
      /* Hover states */
      .video-controller-container {
        opacity: 0.6;
      }
      
      .video-controller-container.hovered {
        opacity: 1;
      }
      
      /* When video is playing and not hovered, reduce opacity */
      .video-controller-container.playing:not(.hovered) {
        opacity: 0.4;
      }
    </style>
    
    <div class="video-controller-container">
      <div class="video-controller-nudge">
        <span class="status-icon">►</span>
      </div>
      <div class="video-controller-expanded">
        <button class="controller-btn play-pause" title="Play">►</button>
        <button class="controller-btn speed-down" title="Decrease Speed">−</button>
        <button class="controller-btn speed-up" title="Increase Speed">+</button>
        <button class="controller-btn close" title="Remove Controller">×</button>
      </div>
    </div>
  `;
  
  // Get elements from shadow DOM
  const controllerContainer = shadowRoot.querySelector('.video-controller-container');
  const controllerNudge = shadowRoot.querySelector('.video-controller-nudge');
  const expandedControls = shadowRoot.querySelector('.video-controller-expanded');
  const playPauseBtn = shadowRoot.querySelector('.play-pause');
  const speedDownBtn = shadowRoot.querySelector('.speed-down');
  const speedUpBtn = shadowRoot.querySelector('.speed-up');
  const closeBtn = shadowRoot.querySelector('.close');
  
  // Add container to video's parent
  const videoContainer = video.parentElement;
  videoContainer.style.position = videoContainer.style.position || 'relative';
  videoContainer.appendChild(shadowContainer);
  
  // Update initial status
  updateControllerStatus(video, controllerNudge, playPauseBtn);
  
  // Track user interaction with videos to determine which one should respond to keyboard shortcuts
  video.addEventListener('mouseover', () => {
    // Move this video to the front of the activeVideos array
    activeVideos = activeVideos.filter(v => v !== video);
    activeVideos.unshift(video);
  });
  
  // Add event listeners for video state
  video.addEventListener('play', (e) => {
    updateControllerStatus(video, controllerNudge, playPauseBtn);
    controllerContainer.classList.add('playing');
  });
  
  video.addEventListener('pause', (e) => {
    updateControllerStatus(video, controllerNudge, playPauseBtn);
    controllerContainer.classList.remove('playing');
  });
  
  video.addEventListener('ratechange', (e) => {
    updateControllerStatus(video, controllerNudge, playPauseBtn);
    // Save the new playback speed
    chrome.storage.local.set({ [`speed_${currentHostname}`]: video.playbackRate });
    // Notify the popup if it's open
    chrome.runtime.sendMessage({
      action: 'speedChanged',
      hostname: currentHostname,
      speed: video.playbackRate
    });
  });
  
  // Add click handler to the minimized widget
  controllerNudge.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // If playback speed is not 1.0, reset to 1.0
    if (video.playbackRate !== 1.0) {
      video.playbackRate = 1.0;
    } else {
      // Otherwise toggle play/pause
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    }
  });
  
  // Variables for hover timing
  let hoverTimeout = null;
  let leaveTimeout = null;
  
  // Add hover handlers with delays
  controllerContainer.addEventListener('mouseenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    clearTimeout(leaveTimeout);
    controllerContainer.classList.add('hovered');
    
    // Show expanded controls after delay
    hoverTimeout = setTimeout(() => {
      expandedControls.classList.add('visible');
    }, 250);
  });
  
  controllerContainer.addEventListener('mouseleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    clearTimeout(hoverTimeout);
    controllerContainer.classList.remove('hovered');
    
    // Hide expanded controls after delay
    leaveTimeout = setTimeout(() => {
      expandedControls.classList.remove('visible');
    }, 1000);
  });
  
  // Button handlers
  playPauseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  });
  
  speedDownBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    let newSpeed = video.playbackRate - 0.1; 
    // Round to 2 decimal places
    newSpeed = Math.round(newSpeed * 100) / 100;
    // Limit to minimum 0.1x
    video.playbackRate = Math.max(0.1, newSpeed);
  });
  
  speedUpBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    let newSpeed = video.playbackRate + 0.2; 
    // Round to 2 decimal places
    newSpeed = Math.round(newSpeed * 100) / 100;
    // Limit to maximum 5x
    video.playbackRate = Math.min(5, newSpeed);
  });
  
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    shadowContainer.remove();
    video.removeAttribute('data-controller-added');
    
    // Remove from active videos list
    activeVideos = activeVideos.filter(v => v !== video);
    
    // Store site as disabled
    if (!disabledSites.includes(currentHostname)) {
      disabledSites.push(currentHostname);
      chrome.storage.local.set({ disabledSites }, () => {
        console.log(`Video controls disabled for ${currentHostname}`);
      });
    }
  });
}

// Update status display
function updateControllerStatus(video, nudge, playPauseBtn) {
  const statusIcon = nudge.querySelector('.status-icon');
  
  if (video.paused) {
    statusIcon.textContent = '❚❚';
    playPauseBtn.innerHTML = '►';
    playPauseBtn.title = 'Play';
  } else {
    if (video.playbackRate !== 1.0) {
      statusIcon.textContent = `${video.playbackRate.toFixed(1)}×`;
    } else {
      statusIcon.textContent = '►';
    }
    playPauseBtn.innerHTML = '❚❚';
    playPauseBtn.title = 'Pause';
  }
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleSiteDisabled') {
    if (message.disabled) {
      // Add current site to disabled list
      if (!disabledSites.includes(currentHostname)) {
        disabledSites.push(currentHostname);
      }
      
      // Remove all controllers
      document.querySelectorAll('.video-controls-shadow-container').forEach(container => {
        container.remove();
      });
      
      document.querySelectorAll('video').forEach(video => {
        video.removeAttribute('data-controller-added');
      });
      
      // Clear active videos
      activeVideos = [];
      
      // Remove keyboard shortcuts
      document.removeEventListener('keydown', setupKeyboardShortcuts);
    } else {
      // Remove current site from disabled list
      disabledSites = disabledSites.filter(site => site !== currentHostname);
      
      // Reinitialize controllers
      initializeVideoController();
      
      // Setup keyboard shortcuts again
      setupKeyboardShortcuts();
    }
    
    // Save updated disabled list
    chrome.storage.local.set({ disabledSites }, () => {
      console.log('Disabled sites updated:', disabledSites);
      sendResponse({ success: true });
    });
    
    return true; // Required for asynchronous response
  }
  
  if (message.action === 'updatePlaybackSpeed') {
    // Find all videos and update their playback speed
    document.querySelectorAll('video').forEach(video => {
      video.playbackRate = message.speed;
    });
    
    // Update saved speed for this site
    chrome.storage.local.set({ [`speed_${currentHostname}`]: message.speed });
    
    sendResponse({ success: true });
    return true;
  }
});

// Initialize on page load
loadDisabledSites();