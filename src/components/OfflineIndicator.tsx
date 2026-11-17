import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-[max(1.25rem,env(safe-area-inset-left))] z-50 flex max-w-[calc(100vw-6.5rem)] items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/95 px-3.5 py-2 text-xs font-mono text-amber-200 shadow-lg backdrop-blur-md print:hidden"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>Offline Mode — Viewing cached portfolio</span>
    </div>
  );
}
