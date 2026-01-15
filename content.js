// Dual Viewport Content Script
// Handles navigation interception and scroll sync

(function() {
  // Prevent double-injection
  if (window.__dualViewportInjected) return;
  window.__dualViewportInjected = true;

  let isPaired = false;
  let isScrolling = false;
  let scrollTimeout = null;

  // Check if this tab is part of a dual view pair
  chrome.runtime.sendMessage({ type: 'CHECK_PAIRED' }, (response) => {
    if (chrome.runtime.lastError) return;
    isPaired = response?.isPaired || false;
    if (isPaired) {
      initSync();
    }
  });

  function initSync() {
    setupLinkInterception();
    setupFormInterception();
    setupScrollSync();
    setupHistoryListener();
  }

  // Intercept link clicks
  function setupLinkInterception() {
    document.addEventListener('click', (e) => {
      // Only handle left clicks without modifiers
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;

      const link = e.target.closest('a');
      if (!link || !link.href) return;

      // Skip javascript: and # links
      if (link.href.startsWith('javascript:') || link.href === location.href + '#') return;

      // Skip links that open in new tab
      if (link.target === '_blank') return;

      // Notify background of navigation
      chrome.runtime.sendMessage({
        type: 'NAV',
        url: link.href
      });

      // Let the click proceed normally - the paired tab will be updated by background
    }, true);
  }

  // Intercept form submissions (GET only)
  function setupFormInterception() {
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (!form || form.method.toLowerCase() !== 'get') return;

      // Build the URL with form data
      const formData = new FormData(form);
      const params = new URLSearchParams(formData);
      const url = new URL(form.action || location.href);
      url.search = params.toString();

      chrome.runtime.sendMessage({
        type: 'NAV',
        url: url.toString()
      });
    }, true);
  }

  // Sync scroll position (percentage-based)
  function setupScrollSync() {
    // Throttle scroll events
    let lastSent = 0;
    const THROTTLE_MS = 50;

    window.addEventListener('scroll', () => {
      // Don't send if we're receiving a scroll sync
      if (isScrolling) return;

      const now = Date.now();
      if (now - lastSent < THROTTLE_MS) return;
      lastSent = now;

      const scrollPercent = getScrollPercent();

      chrome.runtime.sendMessage({
        type: 'SCROLL',
        scrollPercent: scrollPercent
      });
    }, { passive: true });

    // Listen for scroll commands from background
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'SCROLL_TO') {
        applyScrollPercent(msg.scrollPercent);
      }
    });
  }

  function getScrollPercent() {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollHeight <= 0) return { x: 0, y: 0 };

    return {
      x: window.scrollX / (document.documentElement.scrollWidth - window.innerWidth) || 0,
      y: window.scrollY / scrollHeight
    };
  }

  function applyScrollPercent(percent) {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollWidth = document.documentElement.scrollWidth - window.innerWidth;

    const targetY = percent.y * scrollHeight;
    const targetX = percent.x * scrollWidth;

    // Temporarily disable sending scroll events
    isScrolling = true;
    clearTimeout(scrollTimeout);

    window.scrollTo(targetX, targetY);

    // Re-enable after a short delay
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
    }, 100);
  }

  // Listen for History API changes from inject.js
  function setupHistoryListener() {
    window.addEventListener('message', (e) => {
      if (e.source !== window) return;
      if (e.data?.type === '__DV_NAV__') {
        chrome.runtime.sendMessage({
          type: 'NAV',
          url: e.data.url
        });
      }
    });

    // Also handle popstate (back/forward navigation)
    window.addEventListener('popstate', () => {
      chrome.runtime.sendMessage({
        type: 'NAV',
        url: location.href
      });
    });
  }
})();
