import { useCallback, useEffect, useMemo, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const isStandaloneMode = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

const getIsIosSafari = () => {
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/i.test(ua);
  const isWebkit = /WebKit/i.test(ua);
  const isOtherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return isIos && isWebkit && !isOtherIosBrowser;
};

export const useInstallPrompt = (enabled: boolean) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    setIsInstalled(isStandaloneMode());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = () => {
      setIsInstalled(isStandaloneMode());
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery.addEventListener?.('change', handleDisplayModeChange);
    mediaQuery.addListener?.(handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener?.('change', handleDisplayModeChange);
      mediaQuery.removeListener?.(handleDisplayModeChange);
    };
  }, []);

  const isIosManualInstall = useMemo(() => {
    if (typeof window === 'undefined' || !enabled || isInstalled) {
      return false;
    }
    return getIsIosSafari();
  }, [enabled, isInstalled]);

  const canPromptInstall = enabled && !isInstalled && deferredPrompt !== null;
  const canInstall = canPromptInstall || isIosManualInstall;

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unsupported'> => {
    if (!enabled || isInstalled) return 'unsupported';
    if (!deferredPrompt) return 'unsupported';

    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (result.outcome === 'accepted') {
      setIsInstalled(true);
    }
    return result.outcome;
  }, [deferredPrompt, enabled, isInstalled]);

  return {
    canInstall,
    canPromptInstall,
    isInstalled,
    isIosManualInstall,
    promptInstall,
  };
};
