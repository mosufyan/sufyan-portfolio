import { useMemo } from 'react';
import {
  Clock3,
  Copy,
  Link2,
  LogOut,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import {
  OWNER_CONSOLE_SECTIONS,
  buildOwnerConsoleHash,
  type OwnerConsoleSectionId,
} from '../utils/ownerConsoleRouting';
import { OWNER_EMAIL } from '../utils/announcementValidation';

export default function OwnerProfilePanel({
  isLight,
  onSignOut,
  onOpenSection,
}: {
  isLight: boolean;
  onSignOut: () => void;
  onOpenSection: (section: OwnerConsoleSectionId) => void;
}) {
  const { user, isPrimaryOwner, adminAuditLogs, portfolioSettings, adminDelegates } = useFirebase();

  const card = isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#090d16]';
  const subCard = isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800/80 bg-[#070b14]';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const bodyCls = isLight ? 'text-slate-600' : 'text-slate-300';

  const recentAuth = useMemo(
    () =>
      adminAuditLogs
        .filter((e) => e.eventType === 'owner_login' || e.eventType === 'owner_logout')
        .slice(0, 8),
    [adminAuditLogs]
  );

  const deepLinks = OWNER_CONSOLE_SECTIONS.map((section) => ({
    section,
    href: buildOwnerConsoleHash(section),
  }));

  const copyLink = async (href: string) => {
    const absolute = `${window.location.origin}${window.location.pathname}${href}`;
    try {
      await navigator.clipboard.writeText(absolute);
    } catch {
      /* ignore clipboard failures */
    }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row gap-4 ${card}`}>
        <div
          className={`w-16 h-16 rounded-2xl border overflow-hidden shrink-0 flex items-center justify-center ${subCard}`}
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            <UserRound className="w-7 h-7 text-cyan-400" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`text-base font-display font-bold ${titleCls}`}>
              {user?.displayName || 'Portfolio Owner'}
            </h3>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono uppercase ${
                isLight
                  ? 'border-sky-300 bg-sky-50 text-sky-800'
                  : 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300'
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              {isPrimaryOwner ? 'Primary Owner' : 'Delegate Admin'}
            </span>
          </div>
          <p className={`text-xs font-mono break-all ${mutedCls}`}>{user?.email || OWNER_EMAIL}</p>
          <p className={`text-xs ${bodyCls}`}>
            UID <span className="font-mono">{user?.uid || '—'}</span>
            {user?.emailVerified ? ' · email verified' : ''}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={onSignOut}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono cursor-pointer ${
                isLight
                  ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                  : 'border-rose-500/35 bg-rose-950/30 text-rose-300 hover:bg-rose-950/50'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out of owner console
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`rounded-xl border p-4 space-y-3 ${card}`}>
          <div className={`text-xs font-display font-bold flex items-center gap-1.5 ${titleCls}`}>
            <Link2 className="w-4 h-4 text-cyan-400" />
            Deep-linkable console sections
          </div>
          <p className={`text-[11px] ${mutedCls}`}>
            Share or bookmark <span className="font-mono">#owner/&lt;section&gt;</span> URLs. Refresh keeps the
            active workspace tab.
          </p>
          <div className="space-y-1.5">
            {deepLinks.map((item) => (
              <div
                key={item.section}
                className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-mono ${subCard}`}
              >
                <button
                  type="button"
                  onClick={() => onOpenSection(item.section)}
                  className={`truncate text-left cursor-pointer hover:underline ${titleCls}`}
                >
                  {item.href}
                </button>
                <button
                  type="button"
                  onClick={() => void copyLink(item.href)}
                  className={`inline-flex items-center gap-1 shrink-0 cursor-pointer ${mutedCls}`}
                  aria-label={`Copy ${item.section} link`}
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-xl border p-4 space-y-3 ${card}`}>
          <div className={`text-xs font-display font-bold flex items-center gap-1.5 ${titleCls}`}>
            <Clock3 className="w-4 h-4 text-cyan-400" />
            Session &amp; security snapshot
          </div>
          <div className={`rounded-lg border p-3 text-[11px] font-mono space-y-1.5 ${subCard}`}>
            <div className="flex justify-between gap-2">
              <span className={mutedCls}>Incident mode</span>
              <span className={portfolioSettings.incidentMode ? 'text-rose-400 font-semibold' : titleCls}>
                {portfolioSettings.incidentMode ? 'ACTIVE' : 'Off'}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className={mutedCls}>Inquiry alerts</span>
              <span className={titleCls}>{portfolioSettings.notifyOnNewInquiry ? 'On' : 'Off'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className={mutedCls}>Delegate admins</span>
              <span className={titleCls}>{adminDelegates.length}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className={mutedCls}>Provider</span>
              <span className={titleCls}>Google / Firebase Auth</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className={`text-[10px] uppercase tracking-wider font-mono ${mutedCls}`}>
              Recent owner auth events
            </div>
            {recentAuth.length === 0 ? (
              <p className={`text-xs ${mutedCls}`}>No login history in the current audit window.</p>
            ) : (
              recentAuth.map((entry) => (
                <div
                  key={entry.auditId}
                  className={`rounded-lg border px-2.5 py-2 text-[11px] font-mono ${subCard}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={titleCls}>{entry.eventType}</span>
                    <span className={mutedCls}>
                      {new Date(entry.createdAtMs).toLocaleString()}
                    </span>
                  </div>
                  <div className={`truncate mt-0.5 ${mutedCls}`}>{entry.summary}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
