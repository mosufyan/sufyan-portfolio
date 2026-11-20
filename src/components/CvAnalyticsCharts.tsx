import { useId, useMemo, useState } from 'react';
import type { ContactMessageLogRecord } from '../utils/contactMessageLogValidation';
import type { CvDownloadLogRecord } from '../utils/cvDownloadLogValidation';

export type ChartQuickFilter = 'all' | 'pdf' | 'otp' | 'vpn' | 'repeat';

interface CvAnalyticsChartsProps {
  logs: CvDownloadLogRecord[];
  contactLogs?: ContactMessageLogRecord[];
  activeDataset?: 'downloads' | 'messages';
  isLight: boolean;
  activeFilter: ChartQuickFilter;
  onSelectFilter: (next: ChartQuickFilter) => void;
  activeSearch: string;
  onSelectRegion: (country: string) => void;
}

type DayWindow = 7 | 14 | 30;

interface DailyBucket {
  dateKey: string;
  shortLabel: string;
  fullLabel: string;
  total: number;
  pdf: number;
  messages: number;
  vpn: number;
  verified: number;
}

function buildDailySeries(
  logs: CvDownloadLogRecord[],
  contactLogs: ContactMessageLogRecord[],
  days: DayWindow
): DailyBucket[] {
  const now = new Date();
  const buckets = new Map<string, DailyBucket>();
  const orderedKeys: string[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const key = `${yyyy}-${mm}-${dd}`;
    const shortLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const fullLabel = d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    orderedKeys.push(key);
    buckets.set(key, {
      dateKey: key,
      shortLabel,
      fullLabel,
      total: 0,
      pdf: 0,
      messages: 0,
      vpn: 0,
      verified: 0,
    });
  }

  for (const log of logs) {
    const d = new Date(log.createdAtMs);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.total += 1;
    if (log.action === 'pdf') bucket.pdf += 1;
    if (log.isVpnSuspected) bucket.vpn += 1;
    if (
      log.verificationStatus === 'otp_verified' ||
      log.verificationStatus === 'mx_verified'
    ) {
      bucket.verified += 1;
    }
  }

  for (const msg of contactLogs) {
    const d = new Date(msg.createdAtMs);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.messages += 1;
    if (msg.isVpnSuspected) bucket.vpn += 1;
  }

  return orderedKeys.map((k) => buckets.get(k)!);
}

const DONUT_PALETTE_DARK = ['#38bdf8', '#34d399', '#818cf8', '#fbbf24', '#f472b6', '#94a3b8'];
const DONUT_PALETTE_LIGHT = ['#0284c7', '#16a34a', '#4f46e5', '#d97706', '#db2777', '#64748b'];

export default function CvAnalyticsCharts({
  logs,
  contactLogs = [],
  activeDataset = 'downloads',
  isLight,
  activeFilter,
  onSelectFilter,
  activeSearch,
  onSelectRegion,
}: CvAnalyticsChartsProps) {
  const uid = useId().replace(/:/g, '');
  const activityGradId = `cvActivityFill-${uid}`;
  const [dayWindow, setDayWindow] = useState<DayWindow>(14);
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);
  const [hoveredSliceIdx, setHoveredSliceIdx] = useState<number | null>(null);

  const dailySeries = useMemo(
    () => buildDailySeries(logs, contactLogs, dayWindow),
    [logs, contactLogs, dayWindow]
  );

  const formatSlices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs) {
      const label = log.formatLabel || log.action.toUpperCase();
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    const otherTotal = sorted.slice(5).reduce((sum, [, count]) => sum + count, 0);
    if (otherTotal > 0) {
      top.push(['Other Formats', otherTotal]);
    }
    const total = Math.max(1, logs.length);
    const palette = isLight ? DONUT_PALETTE_LIGHT : DONUT_PALETTE_DARK;
    return top.map(([label, count], idx) => ({
      label,
      count,
      pct: Math.round((count / total) * 100),
      color: palette[idx % palette.length],
    }));
  }, [logs, isLight]);

  const securitySegments = useMemo(() => {
    const total = Math.max(1, logs.length);
    let otp = 0;
    let mx = 0;
    let repeat = 0;
    let phoneOnly = 0;
    let vpnFlagged = 0;
    let cleanNetwork = 0;

    for (const log of logs) {
      if (log.verificationStatus === 'otp_verified') otp += 1;
      else if (log.verificationStatus === 'mx_verified') mx += 1;
      else if (log.verificationStatus === 'repeat_session') repeat += 1;
      else phoneOnly += 1;

      if (log.isVpnSuspected) vpnFlagged += 1;
      else cleanNetwork += 1;
    }

    return {
      totalCount: logs.length,
      verification: [
        {
          key: 'otp' as ChartQuickFilter,
          label: 'OTP Verified',
          count: otp,
          pct: Math.round((otp / total) * 100),
          color: isLight ? '#16a34a' : '#34d399',
        },
        {
          key: 'all' as ChartQuickFilter,
          label: 'MX Verified',
          count: mx,
          pct: Math.round((mx / total) * 100),
          color: isLight ? '#0284c7' : '#38bdf8',
        },
        {
          key: 'repeat' as ChartQuickFilter,
          label: 'Repeat Session',
          count: repeat,
          pct: Math.round((repeat / total) * 100),
          color: isLight ? '#4f46e5' : '#818cf8',
        },
        {
          key: 'all' as ChartQuickFilter,
          label: 'Phone Only',
          count: phoneOnly,
          pct: Math.round((phoneOnly / total) * 100),
          color: isLight ? '#d97706' : '#fbbf24',
        },
      ],
      network: [
        {
          key: 'all' as ChartQuickFilter,
          label: 'Clean Network',
          count: cleanNetwork,
          pct: Math.round((cleanNetwork / total) * 100),
          color: isLight ? '#16a34a' : '#34d399',
        },
        {
          key: 'vpn' as ChartQuickFilter,
          label: 'VPN / Proxy Flagged',
          count: vpnFlagged,
          pct: Math.round((vpnFlagged / total) * 100),
          color: isLight ? '#dc2626' : '#fb7185',
        },
      ],
    };
  }, [logs, isLight]);

  const geoSource = useMemo(() => {
    if (activeDataset === 'messages' && contactLogs.length > 0) {
      return contactLogs.map((m) => ({ country: m.country, isVpnSuspected: m.isVpnSuspected }));
    }
    if (logs.length > 0) {
      return logs.map((l) => ({ country: l.country, isVpnSuspected: l.isVpnSuspected }));
    }
    return contactLogs.map((m) => ({ country: m.country, isVpnSuspected: m.isVpnSuspected }));
  }, [activeDataset, contactLogs, logs]);

  const topRegions = useMemo(() => {
    const counts = new Map<string, { total: number; vpn: number }>();
    for (const row of geoSource) {
      const country = row.country || 'Unknown';
      const current = counts.get(country) ?? { total: 0, vpn: 0 };
      current.total += 1;
      if (row.isVpnSuspected) current.vpn += 1;
      counts.set(country, current);
    }
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 6);
    const maxCount = Math.max(1, ...sorted.map(([, v]) => v.total));
    const totalEvents = Math.max(1, geoSource.length);
    return sorted.map(([country, info]) => ({
      country,
      total: info.total,
      vpn: info.vpn,
      barWidthPct: Math.max(6, Math.round((info.total / maxCount) * 100)),
      sharePct: Math.round((info.total / totalEvents) * 100),
    }));
  }, [geoSource]);

  if (logs.length === 0 && contactLogs.length === 0) {
    return null;
  }

  // Timeline geometry
  const svgW = 540;
  const svgH = 156;
  const padL = 28;
  const padR = 14;
  const padT = 14;
  const padB = 26;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;
  const maxDayTotal = Math.max(2, ...dailySeries.map((d) => Math.max(d.total, d.messages, d.vpn)));
  const yMax = Math.ceil(maxDayTotal * 1.15);

  const stepX = dailySeries.length > 1 ? plotW / (dailySeries.length - 1) : plotW;
  const points = dailySeries.map((bucket, idx) => {
    const x = padL + idx * stepX;
    const y = padT + plotH - (bucket.total / yMax) * plotH;
    const msgHeight = (bucket.messages / yMax) * plotH;
    const vpnHeight = (bucket.vpn / yMax) * plotH;
    return { ...bucket, idx, x, y, msgHeight, vpnHeight };
  });

  const linePath = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : '';

  const hoveredPoint = hoveredDayIdx !== null ? points[hoveredDayIdx] ?? null : null;

  // Donut geometry
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;
  const donutArcs = formatSlices.map((slice, idx) => {
    const length = (slice.count / Math.max(1, logs.length)) * circumference;
    const arc = {
      ...slice,
      idx,
      dashArray: `${Math.max(0, length - 2)} ${circumference}`,
      dashOffset: -cumulativeOffset,
    };
    cumulativeOffset += length;
    return arc;
  });

  const activeSlice = hoveredSliceIdx !== null ? donutArcs[hoveredSliceIdx] ?? null : null;

  const panelCls = isLight
    ? 'border-slate-200 bg-white'
    : 'border-slate-800 bg-[#090d16]';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const gridStroke = isLight ? '#e2e8f0' : '#1e293b';
  const primaryHex = isLight ? '#0284c7' : '#38bdf8';
  const msgHex = isLight ? '#16a34a' : '#34d399';
  const riskHex = isLight ? '#dc2626' : '#fb7185';
  const barTrackCls = isLight ? 'bg-slate-100' : 'bg-slate-800/80';

  return (
    <div className="space-y-3">
      {/* 1. Activity Timeline Chart */}
      <div data-pdf-block className={`rounded-xl border p-3.5 sm:p-4 ${panelCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h4 className={`text-sm font-display font-bold ${titleCls}`}>
              Portfolio Engagement &amp; Security Activity
            </h4>
            <p className={`text-[11px] font-mono tabular-nums ${mutedCls}`}>
              {hoveredPoint
                ? `${hoveredPoint.fullLabel}: ${hoveredPoint.total} CV exports (${hoveredPoint.pdf} PDF) · ${hoveredPoint.messages} messages · ${hoveredPoint.vpn} VPN`
                : `Daily CV exports, transmitted messages & flagged VPN traffic (last ${dayWindow} days)`}
            </p>
          </div>

          <div
            className={`inline-flex items-center gap-0.5 p-0.5 rounded-lg border ${
              isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-[#060911]'
            }`}
          >
            {([7, 14, 30] as DayWindow[]).map((win) => (
              <button
                key={win}
                type="button"
                onClick={() => {
                  setDayWindow(win);
                  setHoveredDayIdx(null);
                }}
                className={`px-2 py-1 rounded-md text-[11px] font-mono tabular-nums transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  dayWindow === win
                    ? isLight
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'bg-slate-800 text-cyan-300 font-semibold'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-white'
                }`}
              >
                {win}D
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full h-36 sm:h-40 overflow-visible select-none"
            role="img"
            aria-label={`Download activity over the last ${dayWindow} days`}
            onMouseLeave={() => setHoveredDayIdx(null)}
          >
            <defs>
              <linearGradient id={activityGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={primaryHex} stopOpacity={isLight ? 0.24 : 0.34} />
                <stop offset="100%" stopColor={primaryHex} stopOpacity={0.01} />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines + Y-axis labels */}
            {[0, 0.5, 1].map((frac) => {
              const y = padT + plotH * (1 - frac);
              const val = Math.round(yMax * frac);
              return (
                <g key={frac}>
                  <line
                    x1={padL}
                    x2={svgW - padR}
                    y1={y}
                    y2={y}
                    stroke={gridStroke}
                    strokeWidth={1}
                    strokeDasharray={frac === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={padL - 6}
                    y={y + 3}
                    textAnchor="end"
                    fontSize={9}
                    fontFamily="JetBrains Mono, monospace"
                    fill={isLight ? '#64748b' : '#94a3b8'}
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Area Fill */}
            {areaPath && <path d={areaPath} fill={`url(#${activityGradId})`} />}

            {/* Transmitted Messages bars */}
            {points.map((pt) =>
              pt.messages > 0 ? (
                <rect
                  key={`msg-${pt.dateKey}`}
                  x={pt.vpn > 0 ? pt.x - 6 : pt.x - 3}
                  y={padT + plotH - pt.msgHeight}
                  width={pt.vpn > 0 ? 5 : 6}
                  height={Math.max(2, pt.msgHeight)}
                  rx={2}
                  fill={msgHex}
                  fillOpacity={0.82}
                />
              ) : null
            )}

            {/* VPN / Flagged bars */}
            {points.map((pt) =>
              pt.vpn > 0 ? (
                <rect
                  key={`vpn-${pt.dateKey}`}
                  x={pt.messages > 0 ? pt.x + 1 : pt.x - 3}
                  y={padT + plotH - pt.vpnHeight}
                  width={pt.messages > 0 ? 5 : 6}
                  height={Math.max(2, pt.vpnHeight)}
                  rx={2}
                  fill={riskHex}
                  fillOpacity={0.78}
                />
              ) : null
            )}

            {/* Main Line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={primaryHex}
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Crosshair for hovered point */}
            {hoveredPoint && (
              <line
                x1={hoveredPoint.x}
                x2={hoveredPoint.x}
                y1={padT}
                y2={padT + plotH}
                stroke={primaryHex}
                strokeOpacity={0.4}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}

            {/* Data Points + Interactive Hit Targets */}
            {points.map((pt) => {
              const isHovered = hoveredDayIdx === pt.idx;
              const showXLabel =
                pt.idx === 0 ||
                pt.idx === points.length - 1 ||
                (dayWindow === 7 && pt.idx % 1 === 0) ||
                (dayWindow === 14 && pt.idx % 3 === 0) ||
                (dayWindow === 30 && pt.idx % 6 === 0);

              return (
                <g key={pt.dateKey}>
                  {showXLabel && (
                    <text
                      x={pt.x}
                      y={svgH - 6}
                      textAnchor={
                        pt.idx === 0 ? 'start' : pt.idx === points.length - 1 ? 'end' : 'middle'
                      }
                      fontSize={9}
                      fontFamily="JetBrains Mono, monospace"
                      fill={isLight ? '#64748b' : '#94a3b8'}
                    >
                      {pt.shortLabel}
                    </text>
                  )}

                  {(pt.total > 0 || isHovered) && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 4.5 : 2.75}
                      fill={isLight ? '#ffffff' : '#090d16'}
                      stroke={primaryHex}
                      strokeWidth={isHovered ? 2.5 : 2}
                    />
                  )}

                  <rect
                    x={pt.x - Math.max(8, stepX / 2)}
                    y={padT}
                    width={Math.max(16, stepX)}
                    height={plotH + 8}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredDayIdx(pt.idx)}
                    onClick={() => setHoveredDayIdx(pt.idx)}
                  />
                </g>
              );
            })}
          </svg>

          <div className={`mt-1 flex flex-wrap items-center gap-4 text-[11px] font-mono ${mutedCls}`}>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-0.5 rounded"
                style={{ backgroundColor: primaryHex }}
                aria-hidden="true"
              />
              CV Exports
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-xs"
                style={{ backgroundColor: msgHex }}
                aria-hidden="true"
              />
              Messages Sent
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-xs"
                style={{ backgroundColor: riskHex }}
                aria-hidden="true"
              />
              VPN / Proxy Flagged
            </span>
          </div>
        </div>
      </div>

      {/* 2. Two-Column Visualization Row: Format Mix Donut (when CV logs exist) + Visitor Geography */}
      <div data-pdf-block className={`grid grid-cols-1 ${logs.length > 0 ? 'md:grid-cols-2' : ''} gap-3`}>
        {logs.length > 0 && (
        <div className={`rounded-xl border p-3.5 sm:p-4 flex flex-col justify-between ${panelCls}`}>
          <div>
            <h4 className={`text-sm font-display font-bold ${titleCls}`}>
              CV Format &amp; Export Mix
            </h4>
            <p className={`text-[11px] font-mono ${mutedCls}`}>
              Distribution across resume tracks &amp; actions
            </p>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative w-28 h-28 shrink-0">
              <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90">
                <circle
                  cx={56}
                  cy={56}
                  r={radius}
                  fill="none"
                  stroke={gridStroke}
                  strokeWidth={12}
                />
                {donutArcs.map((arc) => {
                  const isActive = hoveredSliceIdx === arc.idx;
                  return (
                    <circle
                      key={arc.label}
                      cx={56}
                      cy={56}
                      r={radius}
                      fill="none"
                      stroke={arc.color}
                      strokeWidth={isActive ? 15 : 12}
                      strokeDasharray={arc.dashArray}
                      strokeDashoffset={arc.dashOffset}
                      strokeLinecap="butt"
                      className="transition-all duration-150 cursor-pointer"
                      onMouseEnter={() => setHoveredSliceIdx(arc.idx)}
                      onMouseLeave={() => setHoveredSliceIdx(null)}
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
                <span className={`text-lg font-display font-bold tabular-nums leading-none ${titleCls}`}>
                  {activeSlice ? activeSlice.count : logs.length}
                </span>
                <span className={`text-[10px] font-mono tabular-nums mt-0.5 truncate max-w-[68px] ${mutedCls}`}>
                  {activeSlice ? `${activeSlice.pct}%` : 'Total'}
                </span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-1.5 min-w-0">
              {donutArcs.map((arc) => (
                <div
                  key={arc.label}
                  onMouseEnter={() => setHoveredSliceIdx(arc.idx)}
                  onMouseLeave={() => setHoveredSliceIdx(null)}
                  className={`flex items-center justify-between gap-2 text-xs py-0.5 px-1.5 rounded transition-colors ${
                    hoveredSliceIdx === arc.idx
                      ? isLight
                        ? 'bg-slate-100'
                        : 'bg-slate-800/70'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: arc.color }}
                      aria-hidden="true"
                    />
                    <span className={`truncate ${titleCls}`}>{arc.label}</span>
                  </div>
                  <span className={`font-mono text-[11px] tabular-nums shrink-0 ${mutedCls}`}>
                    {arc.count} · {arc.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* Top Regions Bar Chart */}
        <div className={`rounded-xl border p-3.5 sm:p-4 flex flex-col justify-between ${panelCls}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className={`text-sm font-display font-bold ${titleCls}`}>
                Visitor Geography
              </h4>
              <p className={`text-[11px] font-mono ${mutedCls}`}>
                Click a country to filter logs below
              </p>
            </div>
            {activeSearch && (
              <button
                type="button"
                onClick={() => onSelectRegion('')}
                className={`text-[11px] font-mono underline cursor-pointer shrink-0 ${
                  isLight ? 'text-sky-700' : 'text-cyan-400'
                }`}
              >
                Clear
              </button>
            )}
          </div>

          <div className="mt-3 space-y-2">
            {topRegions.map((row) => {
              const isSelected =
                activeSearch.trim().toLowerCase() === row.country.toLowerCase();
              return (
                <button
                  key={row.country}
                  type="button"
                  onClick={() => onSelectRegion(isSelected ? '' : row.country)}
                  className={`w-full text-left group rounded-lg p-1 -mx-1 transition-colors cursor-pointer ${
                    isSelected
                      ? isLight
                        ? 'bg-sky-50'
                        : 'bg-cyan-950/35'
                      : isLight
                        ? 'hover:bg-slate-50'
                        : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs mb-1">
                    <span className={`font-medium truncate ${titleCls}`}>
                      {row.country}
                      {row.vpn > 0 && (
                        <span className="ml-1.5 text-[10px] font-mono text-rose-400 tabular-nums">
                          ({row.vpn} VPN)
                        </span>
                      )}
                    </span>
                    <span className={`font-mono text-[11px] tabular-nums shrink-0 ${mutedCls}`}>
                      {row.total} ({row.sharePct}%)
                    </span>
                  </div>
                  <div className={`h-2 w-full rounded-full overflow-hidden ${barTrackCls}`}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${row.barWidthPct}%`,
                        backgroundColor: isSelected
                          ? primaryHex
                          : row.vpn > 0 && row.vpn === row.total
                            ? riskHex
                            : primaryHex,
                        opacity: isSelected ? 1 : 0.85,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Verification & Network Trust Stacked Proportional Bars */}
      {logs.length > 0 && (
      <div data-pdf-block className={`rounded-xl border p-3.5 sm:p-4 space-y-3 ${panelCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className={`text-sm font-display font-bold ${titleCls}`}>
              Verification &amp; Network Trust Profile
            </h4>
            <p className={`text-[11px] font-mono ${mutedCls}`}>
              Identity proofing vs. network telemetry across {securitySegments.totalCount} events
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Verification Tier Bar */}
          <div className="space-y-2">
            <div className={`text-[11px] font-mono ${mutedCls}`}>Identity Verification Tier</div>
            <div className={`h-3 w-full rounded-full overflow-hidden flex ${barTrackCls}`}>
              {securitySegments.verification.map((seg) =>
                seg.count > 0 ? (
                  <div
                    key={seg.label}
                    style={{
                      width: `${Math.max(3, (seg.count / Math.max(1, securitySegments.totalCount)) * 100)}%`,
                      backgroundColor: seg.color,
                    }}
                    title={`${seg.label}: ${seg.count} (${seg.pct}%)`}
                    className="h-full transition-all duration-300"
                  />
                ) : null
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono tabular-nums">
              {securitySegments.verification.map((seg) => (
                <button
                  key={seg.label}
                  type="button"
                  onClick={() => onSelectFilter(seg.key)}
                  className={`flex items-center justify-between gap-1.5 text-left rounded px-1 py-0.5 transition-colors cursor-pointer ${
                    activeFilter === seg.key && seg.key !== 'all'
                      ? isLight
                        ? 'bg-sky-50 font-semibold'
                        : 'bg-slate-800 font-semibold'
                      : 'hover:opacity-80'
                  }`}
                >
                  <span className={`inline-flex items-center gap-1.5 truncate ${titleCls}`}>
                    <span
                      className="w-2 h-2 rounded-xs shrink-0"
                      style={{ backgroundColor: seg.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{seg.label}</span>
                  </span>
                  <span className={mutedCls}>{seg.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Network Integrity Bar */}
          <div className="space-y-2">
            <div className={`text-[11px] font-mono ${mutedCls}`}>Network Integrity Split</div>
            <div className={`h-3 w-full rounded-full overflow-hidden flex ${barTrackCls}`}>
              {securitySegments.network.map((seg) =>
                seg.count > 0 ? (
                  <div
                    key={seg.label}
                    style={{
                      width: `${Math.max(3, (seg.count / Math.max(1, securitySegments.totalCount)) * 100)}%`,
                      backgroundColor: seg.color,
                    }}
                    title={`${seg.label}: ${seg.count} (${seg.pct}%)`}
                    className="h-full transition-all duration-300"
                  />
                ) : null
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono tabular-nums">
              {securitySegments.network.map((seg) => (
                <button
                  key={seg.label}
                  type="button"
                  onClick={() => onSelectFilter(seg.key)}
                  className={`flex items-center justify-between gap-1.5 text-left rounded px-1 py-0.5 transition-colors cursor-pointer ${
                    activeFilter === seg.key && seg.key !== 'all'
                      ? isLight
                        ? 'bg-rose-50 font-semibold'
                        : 'bg-slate-800 font-semibold'
                      : 'hover:opacity-80'
                  }`}
                >
                  <span className={`inline-flex items-center gap-1.5 truncate ${titleCls}`}>
                    <span
                      className="w-2 h-2 rounded-xs shrink-0"
                      style={{ backgroundColor: seg.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{seg.label}</span>
                  </span>
                  <span className={mutedCls}>
                    {seg.count} ({seg.pct}%)
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
