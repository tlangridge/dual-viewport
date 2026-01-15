# Dual Viewport

A Chrome extension for testing webpages in mobile and desktop views simultaneously with synchronized navigation and scrolling.

## Features

- **Side-by-side views**: Mobile and desktop windows positioned automatically
- **Synchronized navigation**: Click links in either view, both follow
- **Scroll sync**: Percentage-based scroll synchronization between views
- **Device presets**: iPhone 14, Pixel 7, iPad, or custom dimensions
- **User-agent spoofing**: Mobile window sends appropriate mobile UA
- **Independent DevTools**: Open Chrome DevTools on both windows

## Installation

1. Clone this repo or download the source
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `dual-viewport` folder

## Usage

1. Click the Dual Viewport extension icon
2. Select a device preset from the dropdown
3. Enter a URL (defaults to current tab)
4. Click **Launch Dual View**

Two windows will open side-by-side. Navigate or scroll in either window and the other will follow.

## How It Works

- Opens two Chrome windows: mobile-sized (left) and desktop (right)
- Content scripts intercept link clicks, form submissions, and scroll events
- Background service worker routes sync messages between windows
- History API is patched to catch SPA navigation (pushState/replaceState)
- `declarativeNetRequest` modifies User-Agent header for mobile window

## Permissions

- `tabs` - Window/tab management
- `scripting` - Inject sync scripts
- `storage` - Remember last preset
- `system.display` - Auto-position windows
- `webNavigation` - Catch navigation events
- `declarativeNetRequestWithHostAccess` - UA spoofing

## License

MIT
