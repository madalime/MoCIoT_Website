/**
 * Immediately Invoked Function Expression to guard against unsupported devices.
 */
(function () {
  /**
   * Checks if the current page is the error page.
   * @type {boolean}
   */
  const isErrorPage = /\/error\.html$/i.test(location.pathname);
  if (isErrorPage) return;

  /**
   * Detects if the device supports touch input.
   * @type {boolean}
   */
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);

  /**
   * Detects if the device supports orientation events.
   * @type {boolean}
   */
  const hasOrientation = (typeof DeviceOrientationEvent !== 'undefined');

  // Redirect to the error page if the device lacks touch or orientation support
  if (!hasTouch || !hasOrientation) {
    const errorUrl = new URL('/error.html', location.href);
    // Use replace to avoid back-navigation loop
    location.replace(errorUrl.href);
  }
})();
