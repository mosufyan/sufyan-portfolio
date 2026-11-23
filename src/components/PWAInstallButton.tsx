import { useState } from 'react';
import { MonitorSmartphone, Smartphone, Tablet, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  usePWAInstall,
  type InstallPlatform,
  type InstallSurface,
} from '../hooks/usePWAInstall';
import { useFirebase } from '../contexts/FirebaseContext';
import { useTheme } from '../theme/ThemeProvider';
import { useModalPlacement } from '../hooks/useModalPlacement';
import AccessGateModal, {
  ACCESS_SESSION_EXPIRED_MESSAGE,
  isAccessUnlocked,
  trackSubsequentCvEvent,
  type AccessGateAction,
} from './AccessGateModal';

function InstallIcon({ surface }: { surface: InstallSurface }) {
  if (surface === 'desktop') return <MonitorSmartphone className="w-3.5 h-3.5 text-cyan-400" />;
  if (surface === 'tablet') return <Tablet className="w-3.5 h-3.5 text-cyan-400" />;
  return <Smartphone className="w-3.5 h-3.5 text-cyan-400" />;
}

function manualSteps(platform: InstallPlatform, surface: InstallSurface): string[] {
  if (platform === 'ios') {
    return [
      'Open this site in Safari (required on iPhone).',
      'Tap the Share button in the toolbar.',
      'Scroll and tap Add to Home Screen, then Add.',
    ];
  }
  if (platform === 'ipados') {
    return [
      'Open this site in Safari on your iPad.',
      'Tap the Share button in Safari.',
      'Tap Add to Home Screen, then Add.',
    ];
  }
  if (platform === 'android') {
    return [
      surface === 'tablet'
        ? 'Open this site in Chrome on your Android tablet.'
        : 'Open this site in Chrome on your Android phone.',
      'Tap the browser menu (⋮).',
      'Tap Install app / Add to Home screen, then Install.',
    ];
  }
  if (platform === 'mac') {
    return [
      'Open this site in Chrome or Edge on your Mac (best support).',
      'Look for the install icon in the address bar, or open the browser menu.',
      'Choose Install Mohammed Sufyan / Install App.',
    ];
  }
  if (platform === 'windows') {
    return [
      'Open this site in Chrome or Edge on Windows.',
      'Click the install icon in the address bar (or browser menu → Apps).',
      'Choose Install and confirm.',
    ];
  }
  return [
    'Open this site in Chrome or Edge for the best install experience.',
    'Use the install icon in the address bar, or browser menu → Install App.',
    'Confirm Install to add the portfolio app.',
  ];
}

function guideTitle(platform: InstallPlatform, surface: InstallSurface): string {
  if (platform === 'ios') return 'Install on iPhone';
  if (platform === 'ipados') return 'Install on iPad';
  if (platform === 'android' && surface === 'tablet') return 'Install on Android Tablet';
  if (platform === 'android') return 'Install on Android';
  if (platform === 'mac') return 'Install on Mac';
  if (platform === 'windows') return 'Install on Windows';
  if (surface === 'tablet') return 'Install on Tablet';
  if (surface === 'desktop') return 'Install on Desktop';
  return 'Install Portfolio App';
}

export default function PWAInstallButton() {
  const {
    canDirectInstall,
    canOfferInstall,
    isInstalled,
    platform,
    surface,
    label,
    install,
  } = usePWAInstall();

  const [showManualGuide, setShowManualGuide] = useState(false);
  const [gateAction, setGateAction] = useState<AccessGateAction | null>(null);
  const [gateReverifyMessage, setGateReverifyMessage] = useState<string | null>(null);
  const guideAlignClass = useModalPlacement(showManualGuide);
  const { isLight, accent } = useTheme();
  const { recordCvDownloadLog, effectivePortfolioSettings } = useFirebase();

  if (
    !effectivePortfolioSettings.enablePwaInstall ||
    isInstalled ||
    !canOfferInstall
  ) {
    return null;
  }

  /** Native prompt only on a fresh user gesture (same click stack). */
  const runDirectInstall = async () => {
    const ok = await install();
    if (!ok) setShowManualGuide(true);
  };

  const beginInstall = () => {
    if (!isAccessUnlocked('install')) {
      setGateReverifyMessage(null);
      setGateAction('install');
      return;
    }
    void (async () => {
      const track = await trackSubsequentCvEvent({
        action: 'install',
        formatLabel: 'Portfolio PWA',
        theme: isLight ? 'light' : 'dark',
        accent,
        onPersistLog: recordCvDownloadLog,
      });
      if (track.status === 'expired') {
        setGateReverifyMessage(track.message || ACCESS_SESSION_EXPIRED_MESSAGE);
        setGateAction('install');
        return;
      }
      if (canDirectInstall) {
        void runDirectInstall();
        return;
      }
      setShowManualGuide(true);
    })();
  };

  /**
   * After async verification the original click gesture is gone, so Chromium will
   * reject deferredPrompt.prompt(). Open the guide and let "Install now" supply
   * a fresh gesture.
   */
  const handleVerified = (_action: AccessGateAction) => {
    setGateAction(null);
    setGateReverifyMessage(null);
    setShowManualGuide(true);
  };

  const handleGuideInstallNow = () => {
    if (!isAccessUnlocked('install')) {
      setShowManualGuide(false);
      setGateReverifyMessage(null);
      setGateAction('install');
      return;
    }
    setShowManualGuide(false);
    void runDirectInstall();
  };

  const steps = manualSteps(platform, surface);
  const guide = (
    <div
      onClick={() => setShowManualGuide(false)}
      className={`site-overlay fixed inset-0 z-[70] flex ${guideAlignClass} justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-5 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] overflow-y-auto print:hidden`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md 2xl:max-w-lg max-h-[min(calc(100dvh-1.5rem),35.5rem)] lg:max-h-[min(calc(100dvh-3rem),40rem)] flex flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0d121f] shadow-2xl text-left"
      >
        <div className="shrink-0 flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
              <InstallIcon surface={surface} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-display font-bold text-white">
                {guideTitle(platform, surface)}
              </h3>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                {canDirectInstall
                  ? 'Tap Install now to open the native browser prompt'
                  : 'One-time browser steps for this device'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowManualGuide(false)}
            aria-label="Close install instructions"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4">
          <ol className="space-y-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed list-decimal pl-4">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          {canDirectInstall && (
            <button
              type="button"
              onClick={handleGuideInstallNow}
              className="mt-5 w-full rounded-xl bg-cyan-500 hover:bg-cyan-400 py-2.5 text-xs font-semibold text-slate-950 transition-colors"
            >
              Install now
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowManualGuide(false)}
            className={`w-full rounded-xl py-2 text-xs font-semibold transition-colors ${
              canDirectInstall
                ? 'mt-2 border border-slate-700 bg-slate-900/70 text-slate-300 hover:text-white'
                : 'mt-5 bg-cyan-500 hover:bg-cyan-400 text-slate-950'
            }`}
          >
            {canDirectInstall ? 'Close' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={beginInstall}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/50 text-xs font-mono font-semibold text-cyan-300 transition-colors whitespace-nowrap shrink-0 print:hidden"
        title={`${label} — works on phone, tablet, and desktop browsers that support PWAs`}
      >
        <InstallIcon surface={surface} />
        <span>{label}</span>
      </button>

      <AccessGateModal
        action={gateAction}
        formatLabel="Portfolio PWA"
        initialError={gateReverifyMessage}
        onClose={() => {
          setGateAction(null);
          setGateReverifyMessage(null);
        }}
        onVerified={handleVerified}
      />

      {showManualGuide &&
        (typeof document !== 'undefined' ? createPortal(guide, document.body) : guide)}
    </>
  );
}
