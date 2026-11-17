import { useState } from 'react';
import { MonitorSmartphone, Smartphone, Tablet, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  usePWAInstall,
  type InstallPlatform,
  type InstallSurface,
} from '../hooks/usePWAInstall';
import AccessGateModal, { isAccessUnlocked, type AccessGateAction } from './AccessGateModal';

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
  const [pendingInstallMode, setPendingInstallMode] = useState<'direct' | 'manual' | null>(null);

  if (isInstalled || !canOfferInstall) {
    return null;
  }

  const runInstall = async (mode: 'direct' | 'manual') => {
    if (mode === 'direct') {
      const ok = await install();
      // If prompt was dismissed/unavailable, fall back to platform guide
      if (!ok) setShowManualGuide(true);
      return;
    }
    setShowManualGuide(true);
  };

  const beginInstall = () => {
    const mode: 'direct' | 'manual' = canDirectInstall ? 'direct' : 'manual';
    if (isAccessUnlocked()) {
      void runInstall(mode);
      return;
    }
    setPendingInstallMode(mode);
    setGateAction('install');
  };

  const handleVerified = async (_action: AccessGateAction) => {
    setGateAction(null);
    const mode = pendingInstallMode ?? (canDirectInstall ? 'direct' : 'manual');
    setPendingInstallMode(null);
    await runInstall(mode);
  };

  const steps = manualSteps(platform, surface);
  const guide = (
    <div
      onClick={() => setShowManualGuide(false)}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0d121f] p-6 shadow-2xl text-left"
      >
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
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
                  ? 'Native install is available in supported browsers'
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

        <ol className="mt-4 space-y-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed list-decimal pl-4">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        {canDirectInstall && (
          <button
            type="button"
            onClick={() => {
              setShowManualGuide(false);
              void install();
            }}
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
        onClose={() => {
          setGateAction(null);
          setPendingInstallMode(null);
        }}
        onVerified={(action) => {
          void handleVerified(action);
        }}
      />

      {showManualGuide &&
        (typeof document !== 'undefined' ? createPortal(guide, document.body) : guide)}
    </>
  );
}
