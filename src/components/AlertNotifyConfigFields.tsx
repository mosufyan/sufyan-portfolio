import { Bell } from 'lucide-react';
import {
  OWNER_ALERT_CLASSES,
  OWNER_ALERT_EVENT_LABELS,
  type OwnerAlertClass,
  type OwnerAlertEventType,
  type PortfolioSettings,
} from '../utils/ownerGovernance';

type Props = {
  draft: PortfolioSettings;
  setDraft: (updater: (prev: PortfolioSettings) => PortfolioSettings) => void;
  isLight: boolean;
};

const EVENT_CLASS_KEYS: Array<{
  event: OwnerAlertEventType;
  key:
    | 'alertClassNewInquiry'
    | 'alertClassLiveChat'
    | 'alertClassRiskDownload'
    | 'alertClassUnusualTraffic'
    | 'alertClassChatLimit'
    | 'alertClassOverdueCrm';
}> = [
  { event: 'new_inquiry', key: 'alertClassNewInquiry' },
  { event: 'live_chat', key: 'alertClassLiveChat' },
  { event: 'risk_download', key: 'alertClassRiskDownload' },
  { event: 'unusual_traffic', key: 'alertClassUnusualTraffic' },
  { event: 'chat_limit', key: 'alertClassChatLimit' },
  { event: 'overdue_crm', key: 'alertClassOverdueCrm' },
];

export default function AlertNotifyConfigFields({ draft, setDraft, isLight }: Props) {
  const rowCard = isLight
    ? 'border-slate-200 bg-slate-50/70'
    : 'border-slate-800/80 bg-[#070b14]';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const selectCls = isLight
    ? 'border-slate-300 bg-white text-slate-900'
    : 'border-slate-700 bg-[#090d16] text-slate-100';

  return (
    <div className={`rounded-xl border p-3.5 space-y-3 ${rowCard}`}>
      <div>
        <div className={`text-xs font-semibold flex items-center gap-1.5 ${titleCls}`}>
          <Bell className="w-4 h-4 text-cyan-400" />
          Alert &amp; notification routing
        </div>
        <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
          Classify each unusual event as urgent, warning, digest, or off — then choose which classes email
          you immediately so you do not need to live in the Owner Console.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(
          [
            {
              key: 'alertEmailEnabled' as const,
              title: 'Enable email alerts',
              desc: 'Master switch for the notification router.',
            },
            {
              key: 'alertEmailUrgent' as const,
              title: 'Email urgent immediately',
              desc: 'Send [URGENT] mail when an event is classified urgent.',
            },
            {
              key: 'alertEmailWarning' as const,
              title: 'Email warnings immediately',
              desc: 'Send [WARNING] mail for warning-class events.',
            },
            {
              key: 'alertEmailDigest' as const,
              title: 'Queue for digest',
              desc: 'Keep digest/warning/urgent copies for “Email digest now”.',
            },
          ] as const
        ).map((item) => (
          <label
            key={item.key}
            className={`rounded-lg border p-2.5 flex items-start justify-between gap-2 cursor-pointer ${
              isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#090d16]'
            }`}
          >
            <div className="min-w-0">
              <div className={`text-[11px] font-semibold ${titleCls}`}>{item.title}</div>
              <div className={`text-[10px] leading-snug mt-0.5 ${mutedCls}`}>{item.desc}</div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(draft[item.key])}
              onChange={(e) => setDraft((prev) => ({ ...prev, [item.key]: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 shrink-0 cursor-pointer"
            />
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <div className={`text-[10px] font-mono uppercase ${mutedCls}`}>Event classification</div>
        {EVENT_CLASS_KEYS.map(({ event, key }) => (
          <div
            key={key}
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border px-2.5 py-2 ${
              isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#090d16]'
            }`}
          >
            <div className={`text-[11px] ${titleCls}`}>{OWNER_ALERT_EVENT_LABELS[event]}</div>
            <select
              value={draft[key]}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  [key]: e.target.value as OwnerAlertClass,
                }))
              }
              className={`rounded-md border px-2 py-1.5 text-[11px] font-mono cursor-pointer ${selectCls}`}
            >
              {OWNER_ALERT_CLASSES.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
