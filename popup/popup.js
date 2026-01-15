const PRESETS = [
  {
    name: "iPhone 14",
    width: 390,
    height: 844,
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  },
  {
    name: "Pixel 7",
    width: 412,
    height: 915,
    ua: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
  },
  {
    name: "iPad",
    width: 820,
    height: 1180,
    ua: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  },
  {
    name: "Custom",
    width: 375,
    height: 667,
    ua: null // No UA override
  }
];

const deviceSelect = document.getElementById('device');
const urlInput = document.getElementById('url');
const launchBtn = document.getElementById('launch');
const errorDiv = document.getElementById('error');

// Load current tab URL as default
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]?.url && tabs[0].url.startsWith('http')) {
    urlInput.value = tabs[0].url;
  }
});

// Load last used preset
chrome.storage.local.get(['lastPreset'], (result) => {
  if (result.lastPreset !== undefined) {
    deviceSelect.value = result.lastPreset;
  }
});

launchBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();

  // Validate URL
  if (!url) {
    showError('Please enter a URL');
    return;
  }

  let validUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    validUrl = 'https://' + url;
  }

  try {
    new URL(validUrl);
  } catch {
    showError('Invalid URL');
    return;
  }

  const presetIndex = parseInt(deviceSelect.value);
  const preset = PRESETS[presetIndex];

  // Save last used preset
  chrome.storage.local.set({ lastPreset: presetIndex });

  // Send launch message to background
  chrome.runtime.sendMessage({
    action: 'launch',
    url: validUrl,
    preset: preset
  });

  // Close popup
  window.close();
});

function showError(msg) {
  errorDiv.textContent = msg;
  errorDiv.style.display = 'block';
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 3000);
}

// Allow Enter key to launch
urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    launchBtn.click();
  }
});
