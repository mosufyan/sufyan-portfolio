import { useMemo, useState } from 'react';
import { Bell, Loader2, Mail, ShieldAlert } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import {
  buildDigestText,
  buildOwnerAlerts,
  computeFunnelSnapshot,
  EMPTY_SITE_TELEMETRY,
  loadSavedOwnerViews,
  saveSavedOwnerViews,
  type SavedOwnerView,
  type SiteTelemetrySnapshot,
} from '../utils/ownerTracking';
import type { OwnerConsoleSectionId } from '../utils/ownerConsoleRouting';
import { toUserFacingError } from '../utils/userFacingError';

export default function OwnerAlertsPanel({
  isLight,
  onOpenSection,
  telemetry = EMPTY_SITE_TELEMETRY,
}: {
  isLight: boolean;
  onOpenSection: (section: OwnerConsoleSectionId) => void;
  telemetry?: SiteTelemetrySnapshot;
}) {
  const { contactMessageLogs, cvDownloadLogs, user, portfolioSettings, isPrimaryOwner } =
    useFirebase();
  const [digestBusy, setDigestBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [views, setViews] = useState<SavedOwnerView[]>(() => loadSavedOwnerViews());
  const [viewName, setViewName] = useState('');

  const alerts = useMemo(
    () => buildOwnerAlerts({ messages: contactMessageLogs, downloads: cvDownloadLogs }),
    [contactMessageLogs, cvDownloadLogs]
  );
  const funnel = useMemo(
    () => computeFunnelSnapshot(contactMessageLogs, cvDownloadLogs, 30),
    [contactMessageLogs, cvDownloadLogs]
  );

  const card = isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#090d16]';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const inputCls = isLight
    ? 'border-slate-300 bg-white text-slate-900'
    : 'border-slate-700 bg-[#070b14] text-slate-100';

  const sendDigest = async () => {
    if (!user) return;
    setDigestBusy(true);
    setError(null);
    setNotice(null);
    try {
      const idToken = await user.getIdToken();
      const body = buildDigestText({ funnel, alerts, telemetry });
      const res = await fetch('/api/owner/digest-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ subject: 'Portfolio owner digest', body }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || 'Unable to send digest.');
      setNotice('Digest emailed to the primary owner inbox.');
    } catch (err) {
      setError(toUserFacingError(err, 'Digest failed.'));
    } finally {
      setDigestBusy(false);
    }
  };

  const addView = () => {
    const name = viewName.trim().slice(0, 60);
    if (!name) return;
    const next: SavedOwnerView[] = [
      {
        id: `view-${Date.now()}`,
        name,
        section: 'messages' as const,
        triageStatus: 'new',
        createdAtMs: Date.now(),
      },
      ...views,
    ].slice(0, 20);
    setViews(next);
    saveSavedOwnerViews(next);
    setViewName('');
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${card}`}>
        <div>
          <h3 className={`text-sm font-display font-bold flex items-center gap-1.5 ${titleCls}`}>
            <Bell className="w-4 h-4 text-cyan-400" />
            Alerts center
          </h3>
          <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
            Live watchers over inquiries, overdue CRM follow-ups, and risk spikes. Configure email routing
            (urgent / warning / digest) in Owner Profile.
          </p>
        </div>
        <button
          type="button"
          disabled={digestBusy}
          onClick={() => void sendDigest()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#38bdf8] text-slate-950 text-xs font-semibold cursor-pointer disabled:opacity-50"
        >
          {digestBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
          Email digest now
        </button>
      </div>

      <div className={`rounded-xl border p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono ${card}`}>
        {[
          ['Email alerts', portfolioSettings.alertEmailEnabled ? 'On' : 'Off'],
          [
            'Immediate',
            `urgent=${portfolioSettings.alertEmailUrgent ? 'yes' : 'no'} · warning=${
              portfolioSettings.alertEmailWarning ? 'yes' : 'no'
            }`,
          ],
          ['Digest queue', portfolioSettings.alertEmailDigest ? 'On' : 'Off'],
          ['Live chat class', portfolioSettings.alertClassLiveChat],
          ['Risk download class', portfolioSettings.alertClassRiskDownload],
          ['New inquiry class', portfolioSettings.alertClassNewInquiry],
        ].map(([k, v]) => (
          <div key={String(k)} className="flex justify-between gap-2">
            <span className={mutedCls}>{k}</span>
            <span className={titleCls}>{v}</span>
          </div>
        ))}
        {isPrimaryOwner && (
          <button
            type="button"
            onClick={() => onOpenSection('profile')}
            className={`sm:col-span-2 text-left text-[10px] uppercase font-mono cursor-pointer ${
              isLight ? 'text-sky-700 hover:underline' : 'text-cyan-300 hover:underline'
            }`}
          >
            Edit notification classes in Owner Profile →
          </button>
        )}
      </div>

      {notice && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {alerts.length === 0 ? (
          <div className={`rounded-xl border p-4 text-xs font-mono ${card} ${mutedCls}`}>
            No open alerts in the current window.
          </div>
        ) : (
          alerts.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => alert.hrefSection && onOpenSection(alert.hrefSection)}
              className={`w-full text-left rounded-xl border p-3 space-y-1 cursor-pointer ${card}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase font-semibold ${
                    alert.severity === 'critical'
                      ? 'text-rose-400'
                      : alert.severity === 'warning'
                        ? 'text-amber-400'
                        : 'text-cyan-400'
                  }`}
                >
                  <ShieldAlert className="w-3 h-3" />
                  {alert.severity}
                </span>
                <span className={`text-[10px] font-mono ${mutedCls}`}>
                  {new Date(alert.createdAtMs).toLocaleString()}
                </span>
              </div>
              <div className={`text-sm font-semibold ${titleCls}`}>{alert.title}</div>
              <div className={`text-xs ${mutedCls}`}>{alert.detail}</div>
            </button>
          ))
        )}
      </div>

      <div className={`rounded-xl border p-4 space-y-2 ${card}`}>
        <div className={`text-xs font-display font-bold ${titleCls}`}>Saved views</div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder="Name e.g. New hot leads"
            className={`flex-1 min-w-[160px] rounded-lg border px-2.5 py-1.5 text-xs ${inputCls}`}
          />
          <button
            type="button"
            onClick={addView}
            className="px-3 py-1.5 rounded-lg border text-xs font-mono cursor-pointer border-slate-600 text-slate-200"
          >
            Save “New messages” view
          </button>
        </div>
        {views.map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => onOpenSection(view.section)}
            className={`w-full text-left rounded-lg border px-3 py-2 text-xs font-mono cursor-pointer ${
              isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-[#070b14]'
            }`}
          >
            {view.name} → #{view.section}
            {view.triageStatus ? ` · ${view.triageStatus}` : ''}
          </button>
        ))}
      </div>
    </div>
  );
}
