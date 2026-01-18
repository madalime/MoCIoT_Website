(function () {
  const isErrorPage = /\/error\.html$/i.test(location.pathname);
  if (isErrorPage) return;

  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
  const hasOrientation = (typeof DeviceOrientationEvent !== 'undefined');

  if (!hasTouch || !hasOrientation) {
    const errorUrl = new URL('/error.html', location.href);
    // Use replace to avoid back-navigation loop
    location.replace(errorUrl.href);
  }
})();
