
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
  const enableServiceWorkerInDev = import.meta.env.VITE_ENABLE_SW_IN_DEV === 'true';
  const shouldRegisterServiceWorker = import.meta.env.PROD || enableServiceWorkerInDev;
  const devCleanupFlag = 'dev-sw-cleanup-v2';

  const cleanupLegacyServiceWorkerState = async (): Promise<boolean> => {
    let changed = false;
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        changed = true;
      }
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch (error) {
      console.warn('SW cleanup: unregister failed', error);
    }

    if (!('caches' in window)) return changed;
    try {
      const cacheNames = await caches.keys();
      if (cacheNames.length > 0) {
        changed = true;
      }
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    } catch (error) {
      console.warn('SW cleanup: cache cleanup failed', error);
    }
    return changed;
  };

  if (!shouldRegisterServiceWorker) {
    void cleanupLegacyServiceWorkerState().then((changed) => {
      const alreadyReloaded = window.sessionStorage.getItem(devCleanupFlag) === '1';
      if (changed && !alreadyReloaded) {
        window.sessionStorage.setItem(devCleanupFlag, '1');
        window.location.reload();
        return;
      }
      if (!changed) {
        window.sessionStorage.removeItem(devCleanupFlag);
      }
    });
  };

  window.addEventListener('load', () => {
    if (!shouldRegisterServiceWorker) {
      return;
    }

    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
