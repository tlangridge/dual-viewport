// Store tab pairings: tabId -> { pairedTabId, isMobile }
const tabPairs = new Map();

// Track which tabs are ours to avoid infinite nav loops
const navigatingTabs = new Set();

// Listen for launch command from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'launch') {
    launchDualView(msg.url, msg.preset);
  } else if (msg.type === 'NAV') {
    handleNavigation(sender.tab.id, msg.url);
  } else if (msg.type === 'SCROLL') {
    handleScroll(sender.tab.id, msg.scrollPercent);
  } else if (msg.type === 'CHECK_PAIRED') {
    sendResponse({ isPaired: tabPairs.has(sender.tab.id) });
  }
  return true;
});

async function launchDualView(url, preset) {
  try {
    // Get screen dimensions
    const displays = await chrome.system.display.getInfo();
    const { width: screenWidth, height: screenHeight } = displays[0].workArea;

    // Calculate window sizes
    // Add ~30px for Chrome window chrome (borders)
    const mobileWindowWidth = preset.width + 30;
    const desktopWindowWidth = screenWidth - mobileWindowWidth;

    // Create mobile window (left side)
    const mobileWin = await chrome.windows.create({
      url: url,
      width: mobileWindowWidth,
      height: Math.min(preset.height + 100, screenHeight), // +100 for address bar
      left: 0,
      top: 0,
      type: 'normal'
    });

    // Create desktop window (right side)
    const desktopWin = await chrome.windows.create({
      url: url,
      width: desktopWindowWidth,
      height: screenHeight,
      left: mobileWindowWidth,
      top: 0,
      type: 'normal'
    });

    const mobileTabId = mobileWin.tabs[0].id;
    const desktopTabId = desktopWin.tabs[0].id;

    // Store pairings (bidirectional)
    tabPairs.set(mobileTabId, { pairedTabId: desktopTabId, isMobile: true });
    tabPairs.set(desktopTabId, { pairedTabId: mobileTabId, isMobile: false });

    // Set up UA spoofing for mobile tab
    if (preset.ua) {
      await setMobileUA(mobileTabId, preset.ua);
    }

    // Inject content scripts into both tabs once they're ready
    await injectContentScripts(mobileTabId);
    await injectContentScripts(desktopTabId);

  } catch (err) {
    console.error('Failed to launch dual view:', err);
  }
}

async function setMobileUA(mobileTabId, uaString) {
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [mobileTabId], // Use tabId as rule ID for uniqueness
      addRules: [{
        id: mobileTabId,
        priority: 1,
        condition: {
          tabIds: [mobileTabId],
          resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "script", "stylesheet", "image"]
        },
        action: {
          type: "modifyHeaders",
          requestHeaders: [{
            header: "User-Agent",
            operation: "set",
            value: uaString
          }]
        }
      }]
    });
  } catch (err) {
    console.error('Failed to set UA:', err);
  }
}

async function injectContentScripts(tabId) {
  try {
    // Wait a bit for the page to start loading
    await new Promise(resolve => setTimeout(resolve, 100));

    // Inject the main world script for History API patching
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['inject.js'],
      world: 'MAIN'
    });

    // Inject the content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
  } catch (err) {
    console.error('Failed to inject scripts:', err);
  }
}

function handleNavigation(sourceTabId, url) {
  const pairing = tabPairs.get(sourceTabId);
  if (!pairing) return;

  const targetTabId = pairing.pairedTabId;

  // Avoid loops: if target is already navigating, skip
  if (navigatingTabs.has(targetTabId)) return;

  navigatingTabs.add(targetTabId);

  // Navigate the paired tab
  chrome.tabs.update(targetTabId, { url: url }, () => {
    // Re-inject content scripts after navigation
    setTimeout(async () => {
      await injectContentScripts(targetTabId);
      navigatingTabs.delete(targetTabId);
    }, 500);
  });
}

function handleScroll(sourceTabId, scrollPercent) {
  const pairing = tabPairs.get(sourceTabId);
  if (!pairing) return;

  const targetTabId = pairing.pairedTabId;

  // Send scroll command to paired tab
  chrome.tabs.sendMessage(targetTabId, {
    type: 'SCROLL_TO',
    scrollPercent: scrollPercent
  }).catch(() => {
    // Tab might not have content script yet, ignore
  });
}

// Backup: webNavigation.onCommitted catches redirects and navigations we might miss
chrome.webNavigation.onCommitted.addListener((details) => {
  // Only care about main frame navigations
  if (details.frameId !== 0) return;

  const pairing = tabPairs.get(details.tabId);
  if (!pairing) return;

  // Ignore if this navigation was triggered by us
  if (navigatingTabs.has(details.tabId)) return;

  // If it's a user gesture or link click, sync to the other tab
  if (details.transitionType === 'link' || details.transitionType === 'typed' ||
      details.transitionType === 'form_submit' || details.transitionType === 'reload') {
    handleNavigation(details.tabId, details.url);
  }
});

// Re-inject content scripts when a paired tab finishes loading
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return;

  if (tabPairs.has(details.tabId)) {
    await injectContentScripts(details.tabId);
  }
});

// Clean up when tabs/windows close
chrome.tabs.onRemoved.addListener((closedTabId) => {
  const pairing = tabPairs.get(closedTabId);
  if (!pairing) return;

  const pairedTabId = pairing.pairedTabId;

  // Clean up UA rules
  chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [closedTabId, pairedTabId]
  }).catch(() => {});

  // Remove pairings
  tabPairs.delete(closedTabId);
  tabPairs.delete(pairedTabId);

  // Close the paired tab
  chrome.tabs.remove(pairedTabId).catch(() => {
    // Already closed, ignore
  });
});
