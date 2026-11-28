import { useEffect, useRef, useState } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import {
  fetchOwnerSessionStatus,
  touchOwnerServerSession,
  type OwnerSessionStatus,
} from '../utils/ownerServerSession';

/**
 * Soft-warn ~2 minutes before idle/absolute owner session expiry.
 * Activity (pointer/key) and "Stay signed in" reset idle only.
 */
export default function OwnerSessionGuard() {
  const { isOwner, authReady, signOutOwner } = useFirebase();
  const [status, setStatus] = useState<OwnerSessionStatus | null>(null);
  const [dismissedWarn, setDismissedWarn] = useState(false);
  const touchingRef = useRef(false);

  useEffect(() => {
    if (!authReady || !isOwner) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      const next = await fetchOwnerSessionStatus();
      if (cancelled) return;
      setStatus(next);
      if (!next.ok && (next.code === 'session_expired' || next.code === 'session_required')) {
        await signOutOwner();
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [authReady, isOwner, signOutOwner]);

  useEffect(() => {
    if (!authReady || !isOwner) return;
    let timer: number | null = null;
    const onActivity = () => {
      if (touchingRef.current) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        touchingRef.current = true;
        void touchOwnerServerSession()
          .then((next) => {
            setStatus(next);
            if (next.ok) setDismissedWarn(false);
          })
          .finally(() => {
            touchingRef.current = false;
          });
      }, 2_500);
    };
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [authReady, isOwner]);

  if (!isOwner || !status?.ok || !status.warn || dismissedWarn) return null;

  const idleMin = Math.max(1, Math.ceil((status.idleRemainingMs || 0) / 60_000));
  const absMin = Math.max(1, Math.ceil((status.absoluteRemainingMs || 0) / 60_000));

  return (
    <div className="site-overlay fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto max-w-md w-full rounded-2xl border border-amber-500/40 bg-[#0b101b]/95 px-4 py-3 shadow-xl text-slate-100">
        <p className="text-sm font-medium text-amber-200">Owner session ending soon</p>
        <p className="mt-1 text-xs text-slate-300">
          Idle ~{idleMin}m left · absolute ~{absMin}m left. Stay signed in to reset idle time only.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 cursor-pointer"
            onClick={() => {
              void touchOwnerServerSession().then((next) => {
                setStatus(next);
                setDismissedWarn(false);
              });
            }}
          >
            Stay signed in
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 cursor-pointer"
            onClick={() => setDismissedWarn(true)}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
