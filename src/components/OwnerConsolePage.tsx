import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  History,
  LogOut,
  Megaphone,
  MessageSquare,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Activity,
  Bell,
  UserRound,
  Users,
  Wrench,
  Headphones,
} from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { useTheme } from '../theme/ThemeProvider';
import { OWNER_EMAIL } from '../utils/announcementValidation';
import {
  parseOwnerConsoleHash,
  writeOwnerConsoleHash,
  type OwnerConsoleSectionId,
} from '../utils/ownerConsoleRouting';
import { CvAnalyticsPanel, type WorkspaceTab } from './CvAnalyticsView';
import OwnerAnnouncementsPanel from './OwnerAnnouncementsPanel';
import OwnerAlertsPanel from './OwnerAlertsPanel';
import OwnerFunnelPanel from './OwnerFunnelPanel';
import OwnerProfilePanel, { useOwnerOpsHealth } from './OwnerProfilePanel';
import { DelegatesPanel } from './OwnerGovernancePanels';
import OwnerChatPanel from './OwnerChatPanel';

export type OwnerConsoleSection = OwnerConsoleSectionId;

interface OwnerConsolePageProps {
  onBackToPortfolio: () => void;
  onOpenResume: () => void;
  initialSection?: OwnerConsoleSectionId;
}

const WORKSPACE_TABS = new Set<string>(['downloads', 'messages', 'rules', 'settings', 'audit']);

export default function OwnerConsolePage({
  onBackToPortfolio,
  onOpenResume,
  initialSection,
}: OwnerConsolePageProps) {
  const { isLight } = useTheme();
  const {
    user,
    cvDownloadLogs,
    contactMessageLogs,
    announcements,
    accessRules,
    adminAuditLogs,
    adminDelegates,
    portfolioSettings,
    signOutOwner,
  } = useFirebase();

  // Keep live-chat "owner online" presence warm while console is open.
  // Do NOT clear on unmount — React Strict Mode remounts would race beat(false)
  // after beat(true) and leave visitors seeing "owner queued". Logout clears via
  // signOutOwner → POST { online: false }.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const beat = async () => {
      try {
        const token = await user.getIdToken();
        if (cancelled) return;
        await fetch('/api/owner/presence', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ online: true }),
        });
      } catch {
        /* non-fatal */
      }
    };
    void beat();
    const id = window.setInterval(() => void beat(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user]);

  const [section, setSectionState] = useState<OwnerConsoleSection>(() => {
    if (initialSection) return initialSection;
    if (typeof window !== 'undefined') {
      return parseOwnerConsoleHash(window.location.hash).section;
    }
    return 'profile';
  });
  const { telemetry, opsHealth } = useOwnerOpsHealth(true);

  const setSection = (next: OwnerConsoleSection, historyMode: 'push' | 'replace' = 'replace') => {
    setSectionState(next);
    writeOwnerConsoleHash(next, historyMode);
  };

  useEffect(() => {
    const onHash = () => {
      const parsed = parseOwnerConsoleHash(window.location.hash);
      if (parsed.open) setSectionState(parsed.section);
    };
    window.addEventListener('hashchange', onHash);
    writeOwnerConsoleHash(section, 'replace');
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync hash once on mount + listen
  }, []);

  const newInquiryCount = contactMessageLogs.filter((m) => m.triageStatus === 'new').length;

  const navGroups: Array<{
    groupLabel: string;
    items: Array<{
      id: OwnerConsoleSection;
      label: string;
      badge?: string;
      icon: typeof Download;
    }>;
  }> = [
    {
      groupLabel: 'Account',
      items: [
        { id: 'profile', label: 'Owner Profile', icon: UserRound },
        {
          id: 'delegates',
          label: 'Delegates',
          badge: String(adminDelegates.length),
          icon: Users,
        },
      ],
    },
    {
      groupLabel: 'Tracking',
      items: [
        { id: 'funnel', label: 'Funnel', icon: Activity },
        { id: 'alerts', label: 'Alerts', icon: Bell },
        { id: 'chat', label: 'Chat & Live Agent', icon: Headphones },
      ],
    },
    {
      groupLabel: 'Telemetry & Outreach',
      items: [
        {
          id: 'downloads',
          label: 'CV Analytics',
          badge: String(cvDownloadLogs.length),
          icon: Download,
        },
        {
          id: 'messages',
          label: 'Messages & Triage',
          badge:
            newInquiryCount > 0
              ? `${newInquiryCount} new`
              : String(contactMessageLogs.length),
          icon: MessageSquare,
        },
      ],
    },
    {
      groupLabel: 'Content & Governance',
      items: [
        {
          id: 'announcements',
          label: 'Announcements',
          badge: String(announcements.length),
          icon: Megaphone,
        },
        {
          id: 'rules',
          label: 'Allow / Block Rules',
          badge: String(accessRules.length),
          icon: Shield,
        },
        {
          id: 'settings',
          label: 'Site Controls',
          icon: SlidersHorizontal,
        },
        {
          id: 'audit',
          label: 'Admin Audit Log',
          badge: String(adminAuditLogs.length),
          icon: History,
        },
      ],
    },
  ];

  const handleSignOut = async () => {
    await signOutOwner();
    writeOwnerConsoleHash(null);
    onBackToPortfolio();
  };

  const handleBack = () => {
    writeOwnerConsoleHash(null);
    onBackToPortfolio();
  };

  const pageBg = isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#06080d] text-slate-200';
  const surface = isLight
    ? 'border-slate-200 bg-white'
    : 'border-slate-800/90 bg-[#0b101b]';
  const subSurface = isLight
    ? 'border-slate-200 bg-slate-50'
    : 'border-slate-800 bg-[#080c15]';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const accentCls = isLight ? 'text-sky-700' : 'text-cyan-400';

  const activeTitleMap: Record<OwnerConsoleSection, { title: string; subtitle: string }> = {
    profile: {
      title: 'Owner Profile & Session Security',
      subtitle:
        'Identity, ops health, activity timeline, sessions, SEO counters, and deep links for the owner console.',
    },
    funnel: {
      title: 'Visitor Funnel & Conversion',
      subtitle: 'Track inquiry and CV export conversion across rolling time windows.',
    },
    alerts: {
      title: 'Alerts Center & Digests',
      subtitle: 'Watchers for new leads, overdue CRM actions, risk spikes, plus on-demand email digests.',
    },
    chat: {
      title: 'Chat & Live Agent',
      subtitle:
        'Grounded portfolio Q&A volume, OTP-verified live sessions, and real-time visitor replies while you are online.',
    },
    delegates: {
      title: 'Secondary Admin Delegates',
      subtitle: 'Grant trusted teammates console access via Firebase Auth UID allowlisting.',
    },
    downloads: {
      title: 'CV Downloads & Visitor Intelligence',
      subtitle:
        'Interactive analytics charts, exact Light/Dark PDF export, OTP tracking, and network inspection.',
    },
    messages: {
      title: 'Transmitted Messages & Inquiry Triage',
      subtitle:
        'Review OTP-verified submissions, reply from console, classify status, and add private notes.',
    },
    announcements: {
      title: 'Announcements & Publications Manager',
      subtitle:
        'Draft, schedule, and publish career milestones and architecture announcements.',
    },
    rules: {
      title: 'Allowlist & Blocklist Access Rules',
      subtitle:
        'Manage real-time email, domain, and IP policies enforced by server endpoints before dispatch.',
    },
    settings: {
      title: 'Portfolio Feature & Maintenance Toggles',
      subtitle:
        'Incident mode, availability posture, maintenance messaging, alerts, and strict OTP.',
    },
    audit: {
      title: 'Admin Audit & Login History',
      subtitle:
        'Immutable owner authentication and governance audit trail across sessions and rules.',
    },
  };

  const meta = activeTitleMap[section];

  return (
    <div className={`min-h-[calc(100vh-4rem)] w-full transition-colors duration-300 ${pageBg}`}>
      <div className="page-shell py-6 sm:py-8 space-y-6">
        <div
          className={`rounded-2xl border p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm ${surface}`}
        >
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border font-semibold ${
                  isLight
                    ? 'border-sky-300 bg-sky-50 text-sky-800'
                    : 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>OWNER CONSOLE</span>
              </span>
              <span className={mutedCls}>{user?.email || OWNER_EMAIL}</span>
              {portfolioSettings.incidentMode && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold ${
                    isLight
                      ? 'border-rose-300 bg-rose-50 text-rose-800'
                      : 'border-rose-500/40 bg-rose-950/40 text-rose-300'
                  }`}
                >
                  Incident Mode
                </span>
              )}
              {portfolioSettings.maintenanceMode && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold ${
                    isLight
                      ? 'border-amber-300 bg-amber-50 text-amber-800'
                      : 'border-amber-500/40 bg-amber-950/40 text-amber-300'
                  }`}
                >
                  <Wrench className="w-3 h-3" />
                  <span>Maintenance Active</span>
                </span>
              )}
              {portfolioSettings.requireOtpForCv && (
                <span
                  className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
                    isLight
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                  }`}
                >
                  CV OTP Required
                </span>
              )}
              {(!portfolioSettings.requireOtpForChat ||
                !portfolioSettings.requireOtpForContact ||
                !portfolioSettings.requireOtpForCv) && (
                <span
                  className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
                    isLight
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-amber-500/40 bg-amber-950/40 text-amber-200'
                  }`}
                >
                  OTP relaxed
                </span>
              )}
            </div>

            <h1 className={`text-xl sm:text-2xl font-display font-bold tracking-tight ${titleCls}`}>
              {meta.title}
            </h1>
            <p className={`text-xs sm:text-sm ${mutedCls}`}>{meta.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleBack}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                isLight
                  ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  : 'border-slate-700 bg-slate-900/70 text-slate-200 hover:border-cyan-500/40 hover:text-white'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Public Portfolio</span>
            </button>

            <button
              type="button"
              onClick={onOpenResume}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                isLight
                  ? 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100'
                  : 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/50'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>CV Studio</span>
            </button>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
                isLight
                  ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                  : 'border-rose-500/35 bg-rose-950/30 text-rose-300 hover:bg-rose-950/50'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        <div
          className={`lg:hidden flex items-center gap-1.5 overflow-x-auto rounded-xl border p-1.5 ${surface}`}
        >
          {navGroups.flatMap((g) => g.items).map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? item.id === 'messages'
                      ? 'bg-[#34d399] text-slate-950 font-semibold'
                      : 'bg-[#38bdf8] text-slate-950 font-semibold'
                    : isLight
                      ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] tabular-nums ${
                      active
                        ? 'bg-slate-950/15 text-slate-950 font-bold'
                        : isLight
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-slate-900 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <aside className="hidden lg:block lg:col-span-3 sticky top-24 space-y-4">
            <div className={`rounded-2xl border p-3.5 space-y-5 shadow-sm ${surface}`}>
              {navGroups.map((group) => (
                <div key={group.groupLabel} className="space-y-1.5">
                  <div className={`px-2.5 text-[10px] font-mono uppercase tracking-wider ${mutedCls}`}>
                    {group.groupLabel}
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = section === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSection(item.id)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-mono transition-colors cursor-pointer ${
                            active
                              ? item.id === 'messages'
                                ? 'bg-[#34d399] text-slate-950 font-semibold shadow-xs'
                                : 'bg-[#38bdf8] text-slate-950 font-semibold shadow-xs'
                              : isLight
                                ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0 truncate">
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {item.badge !== undefined && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] tabular-nums shrink-0 ${
                                active
                                  ? 'bg-slate-950/15 text-slate-950 font-bold'
                                  : isLight
                                    ? 'bg-slate-100 text-slate-600'
                                    : 'bg-slate-900 text-slate-300'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className={`rounded-xl border p-3 space-y-2 text-[11px] font-mono ${subSurface}`}>
                <div className={`text-[10px] uppercase tracking-wider ${accentCls}`}>
                  Live Enforcement Posture
                </div>
                <div className="flex items-center justify-between">
                  <span className={mutedCls}>Contact Form</span>
                  <span
                    className={
                      portfolioSettings.enableContactForm && !portfolioSettings.incidentMode
                        ? 'text-emerald-500 font-semibold'
                        : 'text-amber-500 font-semibold'
                    }
                  >
                    {portfolioSettings.enableContactForm && !portfolioSettings.incidentMode
                      ? 'Active'
                      : 'Paused'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={mutedCls}>CV Exports</span>
                  <span
                    className={
                      portfolioSettings.enableCvDownloads && !portfolioSettings.incidentMode
                        ? 'text-emerald-500 font-semibold'
                        : 'text-amber-500 font-semibold'
                    }
                  >
                    {portfolioSettings.enableCvDownloads && !portfolioSettings.incidentMode
                      ? 'Active'
                      : 'Paused'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={mutedCls}>Availability</span>
                  <span className={titleCls}>{portfolioSettings.availabilityStatus.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </aside>

          <main className="lg:col-span-9 min-w-0">
            <div className={`rounded-2xl border p-4 sm:p-6 shadow-sm ${surface}`}>
              {section === 'profile' ? (
                <OwnerProfilePanel
                  isLight={isLight}
                  onOpenSection={(next) => setSection(next)}
                  telemetry={telemetry}
                  opsHealth={opsHealth}
                />
              ) : section === 'funnel' ? (
                <OwnerFunnelPanel isLight={isLight} />
              ) : section === 'alerts' ? (
                <OwnerAlertsPanel
                  isLight={isLight}
                  onOpenSection={(next) => setSection(next)}
                  telemetry={telemetry}
                />
              ) : section === 'chat' ? (
                <OwnerChatPanel isLight={isLight} />
              ) : section === 'delegates' ? (
                <DelegatesPanel isLight={isLight} />
              ) : section === 'announcements' ? (
                <OwnerAnnouncementsPanel isLight={isLight} />
              ) : WORKSPACE_TABS.has(section) ? (
                <CvAnalyticsPanel
                  isLight={isLight}
                  activeTab={section as WorkspaceTab}
                  onTabChange={(tab) => setSection(tab)}
                  hideTabBar
                />
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
