import { useMemo, useState } from 'react';
import { Activity, Download, Mail, Percent, Users } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { computeFunnelSnapshot } from '../utils/ownerTracking';

export default function OwnerFunnelPanel({ isLight }: { isLight: boolean }) {
  const { contactMessageLogs, cvDownloadLogs } = useFirebase();
  const [windowDays, setWindowDays] = useState(30);

  const funnel = useMemo(
    () => computeFunnelSnapshot(contactMessageLogs, cvDownloadLogs, windowDays),
    [contactMessageLogs, cvDownloadLogs, windowDays]
  );

  const card = isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#090d16]';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400';

  const tiles = [
    {
      label: 'Inquiries',
      value: funnel.contactMessages,
      sub: `${funnel.contactReplied} replied · ${funnel.contactShortlisted} shortlisted`,
      icon: Mail,
    },
    {
      label: 'Reply rate',
      value: `${(funnel.replyRate * 100).toFixed(0)}%`,
      sub: 'Of OTP-verified messages',
      icon: Percent,
    },
    {
      label: 'CV exports',
      value: funnel.cvExports,
      sub: `${funnel.cvOtpVerified} OTP · ${funnel.cvHighRisk} high-risk`,
      icon: Download,
    },
    {
      label: 'Unique emails',
      value: funnel.uniqueVisitorEmails,
      sub: 'Across contact + CV logs',
      icon: Users,
    },
  ];

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${card}`}>
        <div>
          <h3 className={`text-sm font-display font-bold flex items-center gap-1.5 ${titleCls}`}>
            <Activity className="w-4 h-4 text-cyan-400" />
            Visitor funnel &amp; conversion
          </h3>
          <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
            Derived from live OTP-verified inquiries and CV export telemetry (no extra beacons required for
            these stages).
          </p>
        </div>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setWindowDays(d)}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-mono cursor-pointer ${
                windowDays === d
                  ? 'bg-[#38bdf8] border-[#38bdf8] text-slate-950 font-semibold'
                  : isLight
                    ? 'border-slate-300 text-slate-600'
                    : 'border-slate-700 text-slate-300'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className={`rounded-xl border p-3 ${card}`}>
              <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase ${mutedCls}`}>
                <Icon className="w-3 h-3 text-cyan-400" />
                {tile.label}
              </div>
              <div className={`mt-1 text-xl font-display font-bold tabular-nums ${titleCls}`}>
                {tile.value}
              </div>
              <div className={`text-[10px] font-mono mt-0.5 ${mutedCls}`}>{tile.sub}</div>
            </div>
          );
        })}
      </div>

      <div className={`rounded-xl border p-4 space-y-2 text-xs ${card}`}>
        <div className={`font-mono text-[10px] uppercase ${mutedCls}`}>Stage map (last {windowDays}d)</div>
        <ol className={`space-y-1.5 font-mono ${titleCls}`}>
          <li>1. Contact / CV gate opened → OTP challenge issued (server)</li>
          <li>
            2. Verified inquiries: <strong>{funnel.contactMessages}</strong> · CV unlocks/exports:{' '}
            <strong>{funnel.cvExports}</strong>
          </li>
          <li>
            3. Owner reply / shortlist: <strong>{funnel.contactReplied + funnel.contactShortlisted}</strong>
          </li>
        </ol>
        <p className={mutedCls}>
          Pageview &amp; OG share counters appear on Owner Profile (ops health) once telemetry beacons are
          flowing.
        </p>
      </div>
    </div>
  );
}
