import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  FileDown,
  Globe2,
  Loader2,
  Mail,
  Network,
  Phone,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFirebase } from '../contexts/FirebaseContext';
import { useModalPlacement } from '../hooks/useModalPlacement';
import { useTheme } from '../theme/ThemeProvider';
import {
  buildCsvFromDownloadLogs,
  type CvDownloadLogRecord,
} from '../utils/cvDownloadLogValidation';
import ModalHeaderScan from './ModalHeaderScan';
import { EASE_OUT_EXPO } from './MotionPrimitives';

type AnalyticsFilter = 'all' | 'pdf' | 'otp' | 'vpn' | 'repeat';

function formatVerifyTag(status: CvDownloadLogRecord['verificationStatus']): string {
  if (status === 'otp_verified') return 'OTP VERIFIED';
  if (status === 'mx_verified') return 'MX VERIFIED';
  if (status === 'repeat_session') return 'REPEAT EXPORT';
  return 'PHONE ONLY';
}

function formatTimestamp(ms: number): string {
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

export function CvAnalyticsPanel({ isLight }: { isLight: boolean }) {
  const { cvDownloadLogs, loadingDownloadLogs, deleteCvDownloadLog } = useFirebase();
  const [filter, setFilter] = useState<AnalyticsFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const sessions = new Set<string>();
    const countries = new Map<string, number>();
    const formats = new Map<string, number>();
    let pdfCount = 0;
    let otpCount = 0;
    let mxCount = 0;
    let vpnCount = 0;

    for (const log of cvDownloadLogs) {
      if (log.sessionId) sessions.add(log.sessionId);
      if (log.action === 'pdf') pdfCount += 1;
      if (log.verificationStatus === 'otp_verified') otpCount += 1;
      if (log.verificationStatus === 'mx_verified') mxCount += 1;
      if (log.isVpnSuspected) vpnCount += 1;
      const countryKey = log.country || 'Unknown';
      countries.set(countryKey, (countries.get(countryKey) ?? 0) + 1);
      const fmtKey = log.formatLabel || 'Executive Summary';
      formats.set(fmtKey, (formats.get(fmtKey) ?? 0) + 1);
    }

    const topCountries = Array.from(countries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topFormats = Array.from(formats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return {
      totalEvents: cvDownloadLogs.length,
      uniqueSessions: sessions.size,
      pdfCount,
      verifiedEmailCount: otpCount + mxCount,
      otpCount,
      vpnCount,
      topCountries,
      topFormats,
    };
  }, [cvDownloadLogs]);

  const filteredLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return cvDownloadLogs.filter((log) => {
      if (filter === 'pdf' && log.action !== 'pdf') return false;
      if (filter === 'otp' && log.verificationStatus !== 'otp_verified') return false;
      if (filter === 'vpn' && !log.isVpnSuspected) return false;
      if (filter === 'repeat' && !log.isSubsequent) return false;
      if (!q) return true;
      return [
        log.visitorName,
        log.visitorEmail,
        log.visitorPhone,
        log.ipAddress,
        log.country,
        log.city,
        log.isp,
        log.formatLabel,
        log.reason,
        log.downloadId,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [cvDownloadLogs, filter, searchTerm]);

  const handleExportCsv = () => {
    const csv = buildCsvFromDownloadLogs(filteredLogs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cv-download-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (downloadId: string) => {
    setBusyId(downloadId);
    setActionError(null);
    try {
      await deleteCvDownloadLog(downloadId);
      setConfirmDeleteId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete record.');
    } finally {
      setBusyId(null);
    }
  };

  const statCard = isLight
    ? 'border-slate-200 bg-slate-50'
    : 'border-slate-800 bg-[#090d16]';
  const card = isLight
    ? 'border-slate-200 bg-white hover:border-slate-300'
    : 'border-slate-800 bg-[#090d16] hover:border-slate-700';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const bodyCls = isLight ? 'text-slate-600' : 'text-slate-300';
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const accentCls = isLight ? 'text-sky-700' : 'text-cyan-400';
  const inputCls = isLight
    ? 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-sky-500'
    : 'border-slate-700 bg-[#070b14] text-slate-100 placeholder-slate-500 focus:border-cyan-500';

  return (
    <div className="space-y-4">
      {/* KPI Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className={`rounded-xl border p-3 ${statCard}`}>
          <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase ${mutedCls}`}>
            <Download className={`w-3 h-3 ${accentCls}`} />
            <span>Total Events</span>
          </div>
          <div className={`mt-1 text-xl font-display font-bold ${titleCls}`}>
            {stats.totalEvents}
          </div>
          <div className={`text-[10px] font-mono ${mutedCls}`}>{stats.pdfCount} PDFs</div>
        </div>

        <div className={`rounded-xl border p-3 ${statCard}`}>
          <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase ${mutedCls}`}>
            <Users className={`w-3 h-3 ${accentCls}`} />
            <span>Unique Visitors</span>
          </div>
          <div className={`mt-1 text-xl font-display font-bold ${titleCls}`}>
            {stats.uniqueSessions}
          </div>
          <div className={`text-[10px] font-mono ${mutedCls}`}>Sessions tracked</div>
        </div>

        <div className={`rounded-xl border p-3 ${statCard}`}>
          <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase ${mutedCls}`}>
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Verified Leads</span>
          </div>
          <div className={`mt-1 text-xl font-display font-bold ${titleCls}`}>
            {stats.verifiedEmailCount}
          </div>
          <div className={`text-[10px] font-mono ${mutedCls}`}>{stats.otpCount} OTP verified</div>
        </div>

        <div className={`rounded-xl border p-3 ${statCard}`}>
          <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase ${mutedCls}`}>
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            <span>VPN / Proxy</span>
          </div>
          <div className={`mt-1 text-xl font-display font-bold ${titleCls}`}>
            {stats.vpnCount}
          </div>
          <div className={`text-[10px] font-mono ${mutedCls}`}>Flagged sessions</div>
        </div>
      </div>

      {/* Top Countries & Formats Strip */}
      {(stats.topCountries.length > 0 || stats.topFormats.length > 0) && (
        <div className={`rounded-xl border p-3 space-y-2 ${statCard}`}>
          {stats.topCountries.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
              <span className={`inline-flex items-center gap-1 mr-1 ${mutedCls}`}>
                <Globe2 className="w-3 h-3" /> Regions:
              </span>
              {stats.topCountries.map(([country, count]) => (
                <span
                  key={country}
                  className={`px-2 py-0.5 rounded border ${
                    isLight
                      ? 'border-slate-200 bg-white text-slate-700'
                      : 'border-slate-700 bg-[#0d121f] text-slate-300'
                  }`}
                >
                  {country} ({count})
                </span>
              ))}
            </div>
          )}
          {stats.topFormats.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
              <span className={`inline-flex items-center gap-1 mr-1 ${mutedCls}`}>
                <BarChart3 className="w-3 h-3" /> Formats:
              </span>
              {stats.topFormats.map(([fmt, count]) => (
                <span
                  key={fmt}
                  className={`px-2 py-0.5 rounded border ${
                    isLight
                      ? 'border-sky-200 bg-sky-50 text-sky-800'
                      : 'border-cyan-500/30 bg-cyan-950/30 text-cyan-300'
                  }`}
                >
                  {fmt} ({count})
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${mutedCls}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search name, email, IP, country, ISP, format..."
            className={`w-full rounded-lg border pl-8 pr-3 py-1.5 text-xs focus:outline-none ${inputCls}`}
          />
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filteredLogs.length === 0}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer disabled:opacity-40 shrink-0 ${
            isLight
              ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              : 'border-slate-700 bg-slate-900/70 text-slate-200 hover:border-cyan-500/40'
          }`}
        >
          <FileDown className="w-3.5 h-3.5" />
          <span>Export CSV ({filteredLogs.length})</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['all', `All (${cvDownloadLogs.length})`],
            ['pdf', 'PDF Only'],
            ['otp', 'OTP Verified'],
            ['vpn', 'VPN / Risk Flagged'],
            ['repeat', 'Repeat Exports'],
          ] as Array<[AnalyticsFilter, string]>
        ).map(([key, label]) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-colors cursor-pointer ${
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

      {actionError && (
        <div
          role="alert"
          className={`rounded-xl border px-3 py-2 text-xs ${
            isLight
              ? 'border-rose-300 bg-rose-50 text-rose-800'
              : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
          }`}
        >
          {actionError}
        </div>
      )}

      {loadingDownloadLogs ? (
        <div className={`py-8 flex items-center justify-center gap-2 text-xs font-mono ${mutedCls}`}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading encrypted download telemetry...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className={`rounded-xl border p-6 text-center text-xs font-mono ${statCard} ${mutedCls}`}>
          {cvDownloadLogs.length === 0
            ? 'No CV downloads recorded yet. Verified downloads and exports will stream here in real time.'
            : 'No download records match your current search or filter.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <div key={log.downloadId} className={`rounded-xl border p-3.5 space-y-2.5 ${card}`}>
              {/* Header row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                  <span
                    className={`px-2 py-0.5 rounded border uppercase font-semibold ${
                      log.verificationStatus === 'otp_verified'
                        ? isLight
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                        : log.verificationStatus === 'repeat_session'
                          ? isLight
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                            : 'border-indigo-500/40 bg-indigo-950/40 text-indigo-300'
                          : isLight
                            ? 'border-sky-300 bg-sky-50 text-sky-800'
                            : 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300'
                    }`}
                  >
                    {formatVerifyTag(log.verificationStatus)}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border uppercase font-semibold ${
                      log.isVpnSuspected
                        ? isLight
                          ? 'border-rose-300 bg-rose-50 text-rose-700'
                          : 'border-rose-500/40 bg-rose-950/40 text-rose-300'
                        : isLight
                          ? 'border-slate-200 bg-slate-50 text-slate-600'
                          : 'border-slate-700 bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    {log.isVpnSuspected ? (
                      <AlertTriangle className="w-2.5 h-2.5" />
                    ) : (
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                    )}
                    <span>{log.isVpnSuspected ? `VPN/Proxy · ${log.riskLevel}` : `Low Risk`}</span>
                  </span>

                  <span className={mutedCls}>Ref: {log.downloadId}</span>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className={mutedCls}>{formatTimestamp(log.createdAtMs)}</span>

                  {confirmDeleteId === log.downloadId ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={busyId === log.downloadId}
                        onClick={() => void handleDelete(log.downloadId)}
                        className="px-2 py-0.5 rounded bg-rose-500 hover:bg-rose-400 text-white text-[10px] font-semibold cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className={`px-1.5 py-0.5 rounded border text-[10px] cursor-pointer ${
                          isLight ? 'border-slate-300 text-slate-600' : 'border-slate-700 text-slate-300'
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(log.downloadId)}
                      title="Delete log record"
                      aria-label={`Delete log ${log.downloadId}`}
                      className={`p-1 rounded border transition-colors cursor-pointer ${
                        isLight
                          ? 'border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300'
                          : 'border-slate-800 text-slate-400 hover:text-rose-300 hover:border-rose-500/40'
                      }`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Visitor & Action Info */}
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className={`text-sm font-display font-bold ${titleCls}`}>
                    {log.visitorName || 'Anonymous Visitor'}{' '}
                    <span className={`text-xs font-mono font-normal ${accentCls}`}>
                      — {log.formatLabel} ({log.action.toUpperCase()})
                    </span>
                  </div>
                  <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-1 ${bodyCls}`}>
                    {log.visitorEmail && (
                      <a
                        href={`mailto:${log.visitorEmail}`}
                        className={`inline-flex items-center gap-1 hover:underline ${accentCls}`}
                      >
                        <Mail className="w-3 h-3" />
                        <span>{log.visitorEmail}</span>
                      </a>
                    )}
                    {log.visitorPhone && (
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3" />
                        <span>{log.visitorPhone}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Network Telemetry Grid */}
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 gap-1.5 rounded-lg border p-2.5 text-[11px] font-mono ${
                  isLight ? 'border-slate-200 bg-slate-50/70' : 'border-slate-800/80 bg-[#060911]'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Network className={`w-3 h-3 shrink-0 ${accentCls}`} />
                  <span className={mutedCls}>IP:</span>
                  <span className={titleCls}>{log.ipAddress || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <Globe2 className={`w-3 h-3 shrink-0 ${accentCls}`} />
                  <span className={mutedCls}>Geo:</span>
                  <span className={titleCls}>
                    {[log.city, log.region, log.country].filter(Boolean).join(', ') || 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <Activity className={`w-3 h-3 shrink-0 ${accentCls}`} />
                  <span className={mutedCls}>ISP:</span>
                  <span className={bodyCls}>
                    {log.isp || 'Unknown'} {log.asn ? `(${log.asn})` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <span className={mutedCls}>TZ:</span>
                  <span className={log.timezoneMismatch ? 'text-rose-400 font-semibold' : bodyCls}>
                    {log.timezone || '?'} vs {log.clientTimezone || '?'}
                  </span>
                </div>
              </div>

              <div className={`text-xs leading-relaxed ${bodyCls}`}>
                <span className={`font-mono text-[10px] uppercase mr-1.5 ${mutedCls}`}>Reason:</span>
                {log.reason}
              </div>

              {(log.riskReasons || log.referrer) && (
                <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono ${mutedCls}`}>
                  {log.riskReasons && <span>Signals: {log.riskReasons}</span>}
                  {log.referrer && <span>Source: {log.referrer}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CvAnalyticsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { isLight } = useTheme();
  const { isOwner } = useFirebase();
  const alignClass = useModalPlacement(isOpen);

  if (!isOwner) return null;

  const panel = isLight
    ? 'border-slate-200 bg-white'
    : 'border-slate-700/80 bg-[#0d121f]';
  const footer = isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#0d121f]';
  const backdrop = isLight ? 'bg-slate-900/45' : 'bg-black/80';

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="CV Download Analytics"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`fixed inset-0 z-[65] flex ${alignClass} justify-center p-2.5 sm:p-5 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm overflow-y-auto print:hidden ${backdrop}`}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-2xl 2xl:max-w-3xl max-h-[min(calc(100dvh-1.5rem),36rem)] sm:max-h-[min(calc(100dvh-2.5rem),40rem)] lg:max-h-[min(calc(100dvh-3rem),48rem)] overflow-hidden rounded-2xl border shadow-2xl flex flex-col ${panel}`}
          >
            <div className="relative flex items-start justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800/90 bg-[#0b101b] shrink-0">
              <ModalHeaderScan active={isOpen} />
              <div className="relative flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-display font-bold text-white">
                    CV Download &amp; Security Analytics
                  </h3>
                  <p className="text-[11px] sm:text-xs font-mono text-cyan-400/90">
                    Owner-only audit trail · IP, Geo, ASN, VPN &amp; OTP verification
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close Analytics"
                className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
              <CvAnalyticsPanel isLight={isLight} />
            </div>

            <div className={`px-4 sm:px-6 py-3 border-t flex justify-end shrink-0 ${footer}`}>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
