// Dual Viewport - Main World Script
// Patches History API to detect SPA navigation

(function() {
  // Prevent double-injection
  if (window.__dualViewportHistoryPatched) return;
  window.__dualViewportHistoryPatched = true;

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    const result = originalPushState.apply(this, args);
    notifyNavigation();
    return result;
  };

  history.replaceState = function(...args) {
    const result = originalReplaceState.apply(this, args);
    notifyNavigation();
    return result;
  };

  function notifyNavigation() {
    // Small delay to ensure URL has updated
    setTimeout(() => {
      window.postMessage({
        type: '__DV_NAV__',
        url: location.href
      }, '*');
    }, 0);
  }
})();
