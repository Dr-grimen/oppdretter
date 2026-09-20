/* Offline support is optional. A blocked worker must never block the app. */
(() => {
  'use strict';
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const base = new URL('./', window.location.href);
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(new URL('sw.js', base), {
        scope: base.pathname,
        updateViaCache: 'none',
      });
      const announce = () => {
        if (!registration.waiting) return;
        document.documentElement.dataset.updateAvailable = 'true';
        window.dispatchEvent(new CustomEvent('oppdretter:update'));
      };
      announce();
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', announce);
      });
      window.addEventListener('online', () => { registration.update().catch(() => {}); });
    } catch {
      // Private mode, browser policy or lack of storage can disable offline use.
      // The connected app still works normally.
    }
  }, { once: true });
})();
