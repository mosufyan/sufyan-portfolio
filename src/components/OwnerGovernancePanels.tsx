import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  Download,
  Globe2,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  Plus,
  Save,
  Settings2,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Wrench,
} from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import {
  DEFAULT_PORTFOLIO_SETTINGS,
  type AccessRuleDraft,
  type AccessRuleMatchType,
  type AccessRuleType,
  type AdminAuditEventType,
  type AvailabilityStatus,
  type PortfolioSettings,
  validateAccessRuleDraft,
} from '../utils/ownerGovernance';
import ChatConfigFields from './ChatConfigFields';

function formatAuditTime(ms: number): string {
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(ms).toISOString();
  }
}

function eventMeta(eventType: AdminAuditEventType): {
  label: string;
  tone: 'emerald' | 'slate' | 'amber' | 'sky' | 'rose';
} {
  switch (eventType) {
    case 'owner_login':
      return { label: 'OWNER LOGIN', tone: 'emerald' };
    case 'owner_logout':
      return { label: 'OWNER LOGOUT', tone: 'slate' };
    case 'settings_updated':
      return { label: 'SITE CONTROLS', tone: 'sky' };
    case 'rule_created':
      return { label: 'RULE ADDED', tone: 'amber' };
    case 'rule_deleted':
      return { label: 'RULE REMOVED', tone: 'rose' };
    case 'triage_updated':
      return { label: 'INQUIRY TRIAGE', tone: 'sky' };
    case 'announcement_mutated':
      return { label: 'ANNOUNCEMENTS', tone: 'emerald' };
    case 'owner_reply_sent':
      return { label: 'OWNER REPLY', tone: 'sky' };
    case 'delegate_added':
      return { label: 'DELEGATE ADDED', tone: 'emerald' };
    case 'delegate_removed':
      return { label: 'DELEGATE REMOVED', tone: 'rose' };
    case 'incident_mode_toggled':
      return { label: 'INCIDENT MODE', tone: 'rose' };
    default:
      return { label: 'AUDIT EVENT', tone: 'slate' };
  }
}

export function AccessRulesPanel({ isLight }: { isLight: boolean }) {
  const {
    accessRules,
    loadingAccessRules,
    createAccessRule,
    deleteAccessRule,
    isPrimaryOwner,
  } = useFirebase();
  const [ruleType, setRuleType] = useState<AccessRuleType>('allow');
  const [matchType, setMatchType] = useState<AccessRuleMatchType>('domain');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const card = isLight
    ? 'border-slate-200 bg-white'
    : 'border-slate-800 bg-[#090d16]';
  const subCard = isLight
    ? 'border-slate-200 bg-slate-50'
    : 'border-slate-800/80 bg-[#070b14]';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const bodyCls = isLight ? 'text-slate-600' : 'text-slate-300';
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const inputCls = isLight
    ? 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-sky-500'
    : 'border-slate-700 bg-[#070b14] text-slate-100 placeholder-slate-500 focus:border-cyan-500';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!isPrimaryOwner) {
      setError('Only the primary portfolio owner can create access rules.');
      return;
    }
    setError(null);
    setSuccess(null);

    const draft: AccessRuleDraft = { ruleType, matchType, value, note };
    const check = validateAccessRuleDraft(draft);
    if (!check.valid) {
      setError(check.error || 'Please check the access rule fields.');
      return;
    }

    setBusy(true);
    try {
      await createAccessRule(draft);
      setValue('');
      setNote('');
      setSuccess(
        `${ruleType === 'allow' ? 'Allowlist' : 'Blocklist'} rule saved and synced to server enforcement.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save access rule.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!isPrimaryOwner) {
      setError('Only the primary portfolio owner can delete access rules.');
      return;
    }
    setDeletingId(ruleId);
    setError(null);
    try {
      await deleteAccessRule(ruleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete access rule.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 space-y-3 ${card}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className={`font-display font-bold text-sm ${titleCls}`}>
              Allowlist &amp; Blocklist Policy Manager
            </h4>
            <p className={`text-[11px] font-mono mt-0.5 ${mutedCls}`}>
              Block rules reject submissions with HTTP 403. Allow rules bypass adaptive CV OTP checks (block takes precedence).
              {!isPrimaryOwner && ' Delegates have read-only access to these rules.'}
            </p>
          </div>
          <span
            className={`px-2 py-0.5 rounded border text-[10px] font-mono tabular-nums ${
              isLight
                ? 'border-sky-200 bg-sky-50 text-sky-800'
                : 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300'
            }`}
          >
            {accessRules.length} Active Rules
          </span>
        </div>

        {error && (
          <div
            role="alert"
            className={`rounded-lg border px-3 py-2 text-xs ${
              isLight
                ? 'border-rose-300 bg-rose-50 text-rose-800'
                : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
            }`}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-1.5 ${
              isLight
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-emerald-500/40 bg-emerald-950/35 text-emerald-200'
            }`}
          >
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className={`grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1 ${!isPrimaryOwner ? 'opacity-60 pointer-events-none' : ''}`}
          aria-disabled={!isPrimaryOwner}
        >
          <div className="sm:col-span-3">
            <label className={`block text-[10px] font-mono uppercase mb-1 ${mutedCls}`}>
              Action
            </label>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as AccessRuleType)}
              disabled={!isPrimaryOwner}
              className={`w-full rounded-lg border px-2.5 py-2 text-xs font-mono focus:outline-none ${inputCls}`}
            >
              <option value="allow">Allow (Trusted)</option>
              <option value="block">Block (Reject 403)</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <label className={`block text-[10px] font-mono uppercase mb-1 ${mutedCls}`}>
              Match Target
            </label>
            <select
              value={matchType}
              onChange={(e) => setMatchType(e.target.value as AccessRuleMatchType)}
              className={`w-full rounded-lg border px-2.5 py-2 text-xs font-mono focus:outline-none ${inputCls}`}
            >
              <option value="domain">Domain (e.g. cisco.com)</option>
              <option value="email">Exact Email</option>
              <option value="ip">IP Address</option>
            </select>
          </div>

          <div className="sm:col-span-6">
            <label className={`block text-[10px] font-mono uppercase mb-1 ${mutedCls}`}>
              Target Value *
            </label>
            <input
              type="text"
              required
              maxLength={254}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                matchType === 'domain'
                  ? 'cisco.com'
                  : matchType === 'email'
                    ? 'recruiter@company.com'
                    : '203.0.113.42'
              }
              className={`w-full rounded-lg border px-3 py-2 text-xs font-mono focus:outline-none ${inputCls}`}
            />
          </div>

          <div className="sm:col-span-9">
            <input
              type="text"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional governance note (e.g. Verified executive recruiter)"
              className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none ${inputCls}`}
            />
          </div>

          <div className="sm:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={busy || !isPrimaryOwner}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#38bdf8] hover:bg-sky-300 disabled:opacity-50 text-slate-950 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Add Rule</span>
            </button>
          </div>
        </form>
      </div>

      {loadingAccessRules ? (
        <div className={`py-8 flex items-center justify-center gap-2 text-xs font-mono ${mutedCls}`}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading access rules...</span>
        </div>
      ) : accessRules.length === 0 ? (
        <div className={`rounded-xl border p-6 text-center text-xs font-mono ${subCard} ${mutedCls}`}>
          No custom allowlist or blocklist rules configured yet. Use the form above or 1-click buttons on any visitor card.
        </div>
      ) : (
        <div className="space-y-2">
          {accessRules.map((rule) => {
            const isAllow = rule.ruleType === 'allow';
            return (
              <div
                key={rule.ruleId}
                className={`rounded-xl border p-3 flex flex-wrap items-center justify-between gap-2.5 ${card}`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border uppercase font-semibold ${
                        isAllow
                          ? isLight
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                          : isLight
                            ? 'border-rose-300 bg-rose-50 text-rose-800'
                            : 'border-rose-500/40 bg-rose-950/40 text-rose-300'
                      }`}
                    >
                      {isAllow ? (
                        <ShieldCheck className="w-2.5 h-2.5" />
                      ) : (
                        <ShieldBan className="w-2.5 h-2.5" />
                      )}
                      <span>{isAllow ? 'ALLOW' : 'BLOCK'}</span>
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded border uppercase ${
                        isLight
                          ? 'border-slate-200 bg-slate-100 text-slate-700'
                          : 'border-slate-700 bg-slate-900/70 text-slate-300'
                      }`}
                    >
                      {rule.matchType}
                    </span>

                    <span className={`font-semibold text-xs ${titleCls}`}>{rule.value}</span>
                  </div>

                  {rule.note && <p className={`text-xs ${bodyCls}`}>{rule.note}</p>}
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
                  <span className={mutedCls}>{formatAuditTime(rule.createdAtMs)}</span>
                  <button
                    type="button"
                    disabled={deletingId === rule.ruleId || !isPrimaryOwner}
                    onClick={() => void handleDelete(rule.ruleId)}
                    title={isPrimaryOwner ? 'Delete rule' : 'Primary owner only'}
                    aria-label={`Delete rule ${rule.value}`}
                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-50 ${
                      isLight
                        ? 'border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300'
                        : 'border-slate-800 text-slate-400 hover:text-rose-300 hover:border-rose-500/40'
                    }`}
                  >
                    {deletingId === rule.ruleId ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SiteControlsPanel({ isLight }: { isLight: boolean }) {
  const { portfolioSettings, loadingSettings, savePortfolioSettings } = useFirebase();
  const [draft, setDraft] = useState<PortfolioSettings>(() => ({ ...portfolioSettings }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    setDraft({ ...portfolioSettings });
  }, [portfolioSettings]);

  const hasUnsaved = JSON.stringify(draft) !== JSON.stringify(portfolioSettings);

  const card = isLight
    ? 'border-slate-200 bg-white'
    : 'border-slate-800 bg-[#090d16]';
  const rowCard = isLight
    ? 'border-slate-200 bg-slate-50/70'
    : 'border-slate-800/80 bg-[#070b14]';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const inputCls = isLight
    ? 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-sky-500'
    : 'border-slate-700 bg-[#070b14] text-slate-100 placeholder-slate-500 focus:border-cyan-500';

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSavedNotice(null);
    setSaving(true);
    try {
      await savePortfolioSettings(draft);
      setSavedNotice('Site settings updated in Firestore & synced with backend security rules.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save site controls.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingSettings) {
    return (
      <div className={`py-8 flex items-center justify-center gap-2 text-xs font-mono ${mutedCls}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading live portfolio configuration...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className={`rounded-xl border p-4 space-y-4 ${card}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className={`font-display font-bold text-sm flex items-center gap-1.5 ${titleCls}`}>
              <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
              <span>Portfolio Feature &amp; Maintenance Toggles</span>
            </h4>
            <p className={`text-[11px] font-mono mt-0.5 ${mutedCls}`}>
              Changes update the live site immediately for visitors and enforce on Express API endpoints.
            </p>
          </div>
          {hasUnsaved && (
            <span
              className={`px-2 py-0.5 rounded border text-[10px] font-mono uppercase ${
                isLight
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-amber-500/40 bg-amber-950/40 text-amber-300'
              }`}
            >
              Unsaved Changes
            </span>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className={`rounded-lg border px-3 py-2 text-xs ${
              isLight
                ? 'border-rose-300 bg-rose-50 text-rose-800'
                : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
            }`}
          >
            {error}
          </div>
        )}

        {savedNotice && (
          <div
            role="status"
            className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-1.5 ${
              isLight
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-emerald-500/40 bg-emerald-950/35 text-emerald-200'
            }`}
          >
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}

        {/* Availability Status */}
        <div className={`rounded-xl border p-3.5 space-y-3 ${rowCard}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className={`text-xs font-semibold ${titleCls}`}>Availability Posture</div>
              <div className={`text-[11px] ${mutedCls}`}>
                Controls the live availability indicator shown in the Contact collaboration section.
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['open', 'Open to Roles'],
                  ['advisory', 'Advisory Only'],
                  ['unavailable', 'Unavailable'],
                ] as Array<[AvailabilityStatus, string]>
              ).map(([statusKey, label]) => {
                const active = draft.availabilityStatus === statusKey;
                return (
                  <button
                    key={statusKey}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, availabilityStatus: statusKey }))}
                    className={`px-2.5 py-1 rounded-md border text-[11px] font-mono transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[#38bdf8] border-[#38bdf8] text-slate-950 font-semibold'
                        : isLight
                          ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={`block text-[10px] font-mono uppercase mb-1 ${mutedCls}`}>
              Custom Status Text (Optional, max 140 chars)
            </label>
            <input
              type="text"
              maxLength={140}
              value={draft.availabilityText}
              onChange={(e) => setDraft((prev) => ({ ...prev, availabilityText: e.target.value }))}
              placeholder="e.g. Active · Open to Principal Security & AI Architect Roles"
              className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none ${inputCls}`}
            />
          </div>
        </div>

        {/* Feature & Security Toggles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            {
              key: 'incidentMode' as const,
              icon: ShieldAlert,
              title: 'Incident Mode (one-click lockdown)',
              desc: 'Forces maintenance banner, pauses contact + CV exports, and enables strict OTP.',
            },
            {
              key: 'notifyOnNewInquiry' as const,
              icon: Mail,
              title: 'Alert Tag on New Inquiries',
              desc: 'Prefixes owner notification emails with [ALERT] when a verified inquiry arrives.',
            },
            {
              key: 'maintenanceMode' as const,
              icon: Wrench,
              title: 'Maintenance Banner Mode',
              desc: 'Shows a prominent top announcement bar across the portfolio.',
            },
            {
              key: 'enableContactForm' as const,
              icon: Mail,
              title: 'Enable Contact Submissions',
              desc: 'When paused, the form displays a maintenance notice & direct email link.',
            },
            {
              key: 'enableCvDownloads' as const,
              icon: Download,
              title: 'Enable CV Exports & Print',
              desc: 'Controls whether visitors can download PDF, print, or copy ATS CV.',
            },
            {
              key: 'strictOtpForAll' as const,
              icon: KeyRound,
              title: 'Strict OTP for All CV Exports',
              desc: 'Requires 6-digit email verification for every CV download unless allowlisted.',
            },
            {
              key: 'showAnnouncementsBadge' as const,
              icon: Settings2,
              title: 'Show Announcements Count',
              desc: 'Displays live announcement count pill in the navigation bar.',
            },
          ].map((item) => {
            const Icon = item.icon;
            const checked = Boolean(draft[item.key]);
            return (
              <label
                key={item.key}
                className={`rounded-xl border p-3 flex items-start justify-between gap-3 cursor-pointer transition-colors ${rowCard}`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold ${titleCls}`}>{item.title}</div>
                    <div className={`text-[11px] leading-snug mt-0.5 ${mutedCls}`}>{item.desc}</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, [item.key]: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 shrink-0 cursor-pointer"
                />
              </label>
            );
          })}
        </div>

        {/* Maintenance Message */}
        <div className={`rounded-xl border p-3.5 space-y-1.5 ${rowCard}`}>
          <label className={`block text-[10px] font-mono uppercase ${mutedCls}`}>
            Maintenance Banner Message ({draft.maintenanceMessage.length}/300 chars)
          </label>
          <textarea
            rows={2}
            maxLength={300}
            value={draft.maintenanceMessage}
            onChange={(e) => setDraft((prev) => ({ ...prev, maintenanceMessage: e.target.value }))}
            placeholder={DEFAULT_PORTFOLIO_SETTINGS.maintenanceMessage}
            className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none resize-y ${inputCls}`}
          />
        </div>

        <div className={`rounded-xl border p-3.5 space-y-1.5 ${rowCard}`}>
          <label className={`block text-[10px] font-mono uppercase ${mutedCls}`}>
            Incident Mode Message ({draft.incidentMessage.length}/300 chars)
          </label>
          <textarea
            rows={2}
            maxLength={300}
            value={draft.incidentMessage}
            onChange={(e) => setDraft((prev) => ({ ...prev, incidentMessage: e.target.value }))}
            placeholder={DEFAULT_PORTFOLIO_SETTINGS.incidentMessage}
            className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none resize-y ${inputCls}`}
          />
        </div>

        <ChatConfigFields draft={draft} setDraft={setDraft} isLight={isLight} />

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={saving || !hasUnsaved}
            onClick={() => setDraft({ ...portfolioSettings })}
            className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 ${
              isLight
                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#38bdf8] hover:bg-sky-300 disabled:opacity-50 text-slate-950 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save &amp; Sync Site Controls</span>
          </button>
        </div>
      </div>
    </form>
  );
}

export function AdminAuditPanel({ isLight }: { isLight: boolean }) {
  const {
    adminAuditLogs,
    loadingAuditLogs,
    cvDownloadLogs,
    contactMessageLogs,
  } = useFirebase();
  const [filterCategory, setFilterCategory] = useState<'all' | 'auth' | 'policy' | 'triage'>('all');

  const card = isLight
    ? 'border-slate-200 bg-white'
    : 'border-slate-800 bg-[#090d16]';
  const subCard = isLight
    ? 'border-slate-200 bg-slate-50'
    : 'border-slate-800/80 bg-[#070b14]';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const bodyCls = isLight ? 'text-slate-600' : 'text-slate-300';
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400';

  const filteredLogs = useMemo(() => {
    return adminAuditLogs.filter((entry) => {
      if (filterCategory === 'all') return true;
      if (filterCategory === 'auth') {
        return entry.eventType === 'owner_login' || entry.eventType === 'owner_logout';
      }
      if (filterCategory === 'policy') {
        return (
          entry.eventType === 'settings_updated' ||
          entry.eventType === 'rule_created' ||
          entry.eventType === 'rule_deleted' ||
          entry.eventType === 'delegate_added' ||
          entry.eventType === 'delegate_removed' ||
          entry.eventType === 'incident_mode_toggled'
        );
      }
      return (
        entry.eventType === 'triage_updated' ||
        entry.eventType === 'announcement_mutated' ||
        entry.eventType === 'owner_reply_sent'
      );
    });
  }, [adminAuditLogs, filterCategory]);

  const flaggedSecurityEvents = useMemo(() => {
    const cvFlagged = cvDownloadLogs
      .filter((l) => l.isVpnSuspected || l.riskLevel !== 'low')
      .map((l) => ({
        id: l.downloadId,
        kind: 'CV Export',
        actor: l.visitorEmail || l.visitorPhone || 'Anonymous',
        ip: l.ipAddress,
        geo: [l.city, l.country].filter(Boolean).join(', ') || 'Unknown',
        reason: l.riskReasons || l.riskLevel,
        ms: l.createdAtMs,
      }));
    const msgFlagged = contactMessageLogs
      .filter((m) => m.isVpnSuspected || m.riskLevel !== 'low')
      .map((m) => ({
        id: m.messageId,
        kind: 'Inquiry',
        actor: m.senderEmail,
        ip: m.ipAddress,
        geo: [m.city, m.country].filter(Boolean).join(', ') || 'Unknown',
        reason: m.riskReasons || m.riskLevel,
        ms: m.createdAtMs,
      }));
    return [...cvFlagged, ...msgFlagged].sort((a, b) => b.ms - a.ms).slice(0, 6);
  }, [cvDownloadLogs, contactMessageLogs]);

  return (
    <div className="space-y-4">
      {/* High-Risk / Flagged Telemetry Digest */}
      <div className={`rounded-xl border p-4 space-y-2.5 ${card}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-display font-bold">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span className={titleCls}>Recent Flagged Network &amp; VPN Signals</span>
          </div>
          <span className={`text-[11px] font-mono tabular-nums ${mutedCls}`}>
            {flaggedSecurityEvents.length} recent alerts
          </span>
        </div>

        {flaggedSecurityEvents.length === 0 ? (
          <p className={`text-xs font-mono ${mutedCls}`}>
            No high-risk or VPN/Proxy visitor anomalies recorded yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {flaggedSecurityEvents.map((ev) => (
              <div key={ev.id} className={`rounded-lg border p-2.5 text-[11px] font-mono space-y-1 ${subCard}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-rose-400 font-semibold uppercase flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{ev.kind}</span>
                  </span>
                  <span className={mutedCls}>{formatAuditTime(ev.ms)}</span>
                </div>
                <div className={`truncate ${titleCls}`}>{ev.actor}</div>
                <div className={`truncate ${mutedCls}`}>
                  {ev.ip || 'Unknown IP'} · {ev.geo}
                </div>
                {ev.reason && <div className="text-[10px] text-amber-400 truncate">{ev.reason}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', `All Events (${adminAuditLogs.length})`],
              ['auth', 'Logins & Logouts'],
              ['policy', 'Rules & Settings'],
              ['triage', 'Triage & Feed'],
            ] as const
          ).map(([key, label]) => {
            const active = filterCategory === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilterCategory(key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? isLight
                      ? 'bg-sky-50 border-sky-400 text-sky-800'
                      : 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : isLight
                      ? 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      : 'bg-[#090d16] border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Audit Timeline */}
      {loadingAuditLogs ? (
        <div className={`py-8 flex items-center justify-center gap-2 text-xs font-mono ${mutedCls}`}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading owner audit history...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className={`rounded-xl border p-6 text-center text-xs font-mono ${subCard} ${mutedCls}`}>
          No owner audit events recorded for this filter yet. Sign-ins, settings changes, triage updates, and rule updates are logged automatically.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((entry) => {
            const meta = eventMeta(entry.eventType);
            const toneCls =
              meta.tone === 'emerald'
                ? isLight
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                : meta.tone === 'amber'
                  ? isLight
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-amber-500/40 bg-amber-950/40 text-amber-300'
                  : meta.tone === 'rose'
                    ? isLight
                      ? 'border-rose-300 bg-rose-50 text-rose-800'
                      : 'border-rose-500/40 bg-rose-950/40 text-rose-300'
                    : meta.tone === 'sky'
                      ? isLight
                        ? 'border-sky-300 bg-sky-50 text-sky-800'
                        : 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300'
                      : isLight
                        ? 'border-slate-300 bg-slate-100 text-slate-700'
                        : 'border-slate-700 bg-slate-900/70 text-slate-300';

            return (
              <div key={entry.auditId} className={`rounded-xl border p-3 space-y-1.5 ${card}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border uppercase font-semibold ${toneCls}`}>
                      {entry.eventType === 'owner_login' ? (
                        <LogIn className="w-2.5 h-2.5" />
                      ) : entry.eventType === 'owner_logout' ? (
                        <LogOut className="w-2.5 h-2.5" />
                      ) : (
                        <ShieldCheck className="w-2.5 h-2.5" />
                      )}
                      <span>{meta.label}</span>
                    </span>
                    <span className={mutedCls}>{entry.actorEmail}</span>
                  </div>

                  <span className={`inline-flex items-center gap-1 ${mutedCls}`}>
                    <Clock className="w-3 h-3" />
                    <span>{formatAuditTime(entry.createdAtMs)}</span>
                  </span>
                </div>

                <div className={`text-xs font-medium ${bodyCls}`}>{entry.summary}</div>

                <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono ${mutedCls}`}>
                  {entry.hostname && (
                    <span className="inline-flex items-center gap-1">
                      <Globe2 className="w-2.5 h-2.5" />
                      <span>{entry.hostname}</span>
                    </span>
                  )}
                  {entry.timezone && <span>TZ: {entry.timezone}</span>}
                  <span>Ref: {entry.auditId}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DelegatesPanel({ isLight }: { isLight: boolean }) {
  const {
    isPrimaryOwner,
    adminDelegates,
    loadingDelegates,
    addAdminDelegate,
    removeAdminDelegate,
  } = useFirebase();
  const [uid, setUid] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const card = isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#090d16]';
  const subCard = isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800/80 bg-[#070b14]';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const inputCls = isLight
    ? 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-sky-500'
    : 'border-slate-700 bg-[#070b14] text-slate-100 placeholder-slate-500 focus:border-cyan-500';

  if (!isPrimaryOwner) {
    return (
      <div className={`rounded-xl border p-4 text-xs ${card} ${mutedCls}`}>
        Delegate admin management is restricted to the primary owner account.
      </div>
    );
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await addAdminDelegate({ uid, email });
      setUid('');
      setEmail('');
      setSuccess('Delegate admin added. They can open the Owner Console after Google sign-in.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add delegate.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => void handleAdd(e)} className={`rounded-xl border p-4 space-y-3 ${card}`}>
        <div>
          <h4 className={`text-sm font-display font-bold ${titleCls}`}>Secondary Admin Delegates</h4>
          <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
            Add Firebase Auth UIDs for teammates who should access console analytics and triage. Policy sync and
            reply email remain primary-owner only.
          </p>
        </div>
        {error && (
          <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
            {success}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            placeholder="Firebase UID"
            className={`rounded-lg border px-3 py-2 text-xs focus:outline-none ${inputCls}`}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Delegate email"
            className={`rounded-lg border px-3 py-2 text-xs focus:outline-none ${inputCls}`}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#38bdf8] text-slate-950 text-xs font-semibold cursor-pointer disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Add Delegate
        </button>
      </form>

      <div className={`rounded-xl border p-4 space-y-2 ${card}`}>
        <div className={`text-xs font-mono ${mutedCls}`}>
          {loadingDelegates ? 'Loading delegates…' : `${adminDelegates.length} delegate(s)`}
        </div>
        {adminDelegates.map((delegate) => (
          <div
            key={delegate.uid}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${subCard}`}
          >
            <div className="min-w-0">
              <div className={`font-mono truncate ${titleCls}`}>{delegate.email}</div>
              <div className={`font-mono text-[10px] truncate ${mutedCls}`}>{delegate.uid}</div>
            </div>
            <button
              type="button"
              onClick={() => void removeAdminDelegate(delegate.uid)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-rose-500/40 text-rose-300 text-[11px] cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
