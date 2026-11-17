import { useCallback, useEffect, useMemo, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallPlatform =
  | 'ios'
  | 'ipados'
  | 'android'
  | 'windows'
  | 'mac'
  | 'linux'
  | 'other';

export type InstallSurface = 'phone' | 'tablet' | 'desktop';

function detectPlatform(): { platform: InstallPlatform; surface: InstallSurface } {
  if (typeof window === 'undefined') {
    return { platform: 'other', surface: 'desktop' };
  }

  const ua = window.navigator.userAgent.toLowerCase();
  const maxTouchPoints = window.navigator.maxTouchPoints || 0;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const narrowViewport = window.matchMedia('(max-width: 900px)').matches;

  // iPadOS 13+ can report as Macintosh with touch
  const isIPadOSDesktopUa =
    /macintosh/.test(ua) && maxTouchPoints > 1;
  const isIOSPhone = /iphone|ipod/.test(ua);
  const isIPad = /ipad/.test(ua) || isIPadOSDesktopUa;
  const isAndroid = /android/.test(ua);
  const isWindows = /windows/.test(ua);
  const isMac = /macintosh|mac os x/.test(ua) && !isIPadOSDesktopUa;
  const isLinux = /linux/.test(ua) && !isAndroid;

  let platform: InstallPlatform = 'other';
  if (isIOSPhone) platform = 'ios';
  else if (isIPad) platform = 'ipados';
  else if (isAndroid) platform = 'android';
  else if (isWindows) platform = 'windows';
  else if (isMac) platform = 'mac';
  else if (isLinux) platform = 'linux';

  let surface: InstallSurface = 'desktop';
  if (platform === 'ios') surface = 'phone';
  else if (platform === 'ipados') surface = 'tablet';
  else if (platform === 'android') {
    // Android tablets are usually wider / often lack "Mobile" token
    const looksPhone = /mobile/.test(ua) || (narrowViewport && coarsePointer);
    surface = looksPhone ? 'phone' : 'tablet';
  } else if (coarsePointer && maxTouchPoints > 1 && narrowViewport) {
    surface = 'tablet';
  }

  return { platform, surface };
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [{ platform, surface }, setDevice] = useState(() => detectPlatform());

  useEffect(() => {
    setIsInstalled(isStandaloneDisplay());
    setDevice(detectPlatform());

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const handleVisibility = () => {
      if (isStandaloneDisplay()) {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const canDirectInstall = !!deferredPrompt;
  const needsManualInstall = !canDirectInstall && !isInstalled;
  const isAppleMobile = platform === 'ios' || platform === 'ipados';

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === 'accepted') {
        setIsInstalled(true);
        return true;
      }
      return false;
    } catch {
      // Gesture/timing failures must not become unhandled rejections
      setDeferredPrompt(null);
      return false;
    }
  }, [deferredPrompt]);

  const label = useMemo(() => {
    if (isInstalled) return 'Installed';
    if (canDirectInstall) {
      if (surface === 'desktop') return 'Install App';
      if (surface === 'tablet') return 'Install on Tablet';
      return 'Install App';
    }
    if (platform === 'ios') return 'Install on iPhone';
    if (platform === 'ipados') return 'Install on iPad';
    if (platform === 'android') return surface === 'tablet' ? 'Install on Tablet' : 'Install on Android';
    if (platform === 'mac') return 'Install on Mac';
    if (platform === 'windows') return 'Install on Windows';
    return 'Install App';
  }, [isInstalled, canDirectInstall, surface, platform]);

  return {
    /** Native Chromium/Edge install prompt is available */
    canDirectInstall,
    /** Show Install control even when only a manual path exists */
    canOfferInstall: !isInstalled,
    needsManualInstall,
    isInstalled,
    isIOS: isAppleMobile,
    platform,
    surface,
    label,
    install,
  };
}
