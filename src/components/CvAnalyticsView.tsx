import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileDown,
  FileText,
  Globe2,
  History,
  Loader2,
  Mail,
  MessageSquare,
  Moon,
  Network,
  Phone,
  Search,
  Shield,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Sun,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFirebase } from '../contexts/FirebaseContext';
import { useModalPlacement } from '../hooks/useModalPlacement';
import { useTheme } from '../theme/ThemeProvider';
import {
  CONTACT_TRIAGE_STATUSES,
  LEAD_OUTCOMES,
  LEAD_PRIORITIES,
  LEAD_SOURCES,
  buildCsvFromContactLogs,
  type ContactMessageLogRecord,
  type ContactTriageStatus,
  type LeadCrmFields,
} from '../utils/contactMessageLogValidation';
import {
  buildCsvFromDownloadLogs,
  type CvDownloadLogRecord,
} from '../utils/cvDownloadLogValidation';
import { evaluateAccessRules } from '../utils/ownerGovernance';
import {
  OWNER_REPLY_TEMPLATES,
  composeOwnerReplySubject,
} from '../utils/ownerConsoleRouting';
import CvAnalyticsCharts from './CvAnalyticsCharts';
import ModalHeaderScan from './ModalHeaderScan';
import { EASE_OUT_EXPO } from './MotionPrimitives';
import { toUserFacingError } from '../utils/userFacingError';
import {
  AccessRulesPanel,
  AdminAuditPanel,
  SiteControlsPanel,
} from './OwnerGovernancePanels';

type AnalyticsFilter = 'all' | 'pdf' | 'otp' | 'vpn' | 'repeat';
type MessageFilter = 'all' | 'vpn' | 'phone';
type TriagePipelineFilter = 'all' | ContactTriageStatus;
export type WorkspaceTab = 'downloads' | 'messages' | 'rules' | 'settings' | 'audit';

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

function triageBadgeStyle(status: ContactTriageStatus, isLight: boolean): {
  label: string;
  cls: string;
} {
  switch (status) {
    case 'replied':
      return {
        label: 'REPLIED',
        cls: isLight
          ? 'border-sky-300 bg-sky-50 text-sky-800'
          : 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300',
      };
    case 'shortlisted':
      return {
        label: 'SHORTLISTED',
        cls: isLight
          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
          : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300',
      };
    case 'archived':
      return {
        label: 'ARCHIVED',
        cls: isLight
          ? 'border-slate-300 bg-slate-100 text-slate-600'
          : 'border-slate-700 bg-slate-900/70 text-slate-400',
      };
    default:
      return {
        label: 'NEW',
        cls: isLight
          ? 'border-amber-300 bg-amber-50 text-amber-800'
          : 'border-amber-500/40 bg-amber-950/40 text-amber-300',
      };
  }
}

function extractDomain(email: string): string {
  const idx = email.indexOf('@');
  if (idx < 0) return '';
  return email.slice(idx + 1).trim().toLowerCase();
}

export function CvAnalyticsPanel({
  isLight,
  activeTab: controlledTab,
  onTabChange,
  hideTabBar = false,
}: {
  isLight: boolean;
  activeTab?: WorkspaceTab;
  onTabChange?: (tab: WorkspaceTab) => void;
  hideTabBar?: boolean;
}) {
  const {
    cvDownloadLogs,
    loadingDownloadLogs,
    deleteCvDownloadLog,
    contactMessageLogs,
    loadingContactLogs,
    deleteContactMessageLog,
    updateContactMessageTriage,
    replyToContactMessage,
    accessRules,
    createAccessRule,
    adminAuditLogs,
  } = useFirebase();

  const [uncontrolledTab, setUncontrolledTab] = useState<WorkspaceTab>('downloads');
  const workspaceTab = controlledTab ?? uncontrolledTab;
  const setWorkspaceTab = (next: WorkspaceTab) => {
    if (onTabChange) onTabChange(next);
    if (controlledTab === undefined) setUncontrolledTab(next);
  };
  const [filter, setFilter] = useState<AnalyticsFilter>('all');
  const [msgFilter, setMsgFilter] = useState<MessageFilter>('all');
  const [triageFilter, setTriageFilter] = useState<TriagePipelineFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ruleBusyKey, setRuleBusyKey] = useState<string | null>(null);
  const [triageNotesDraft, setTriageNotesDraft] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, { subject: string; body: string }>>(
    {}
  );
  const [crmDrafts, setCrmDrafts] = useState<Record<string, Partial<LeadCrmFields>>>({});
  const [replyBusyId, setReplyBusyId] = useState<string | null>(null);
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [pdfTheme, setPdfTheme] = useState<'light' | 'dark'>(() => (isLight ? 'light' : 'dark'));
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfRenderJob, setPdfRenderJob] = useState<{
    theme: 'light' | 'dark';
    dataset: 'downloads' | 'messages';
  } | null>(null);
  const pdfHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPdfTheme(isLight ? 'light' : 'dark');
  }, [isLight]);

  const stats = useMemo(() => {
    const sessions = new Set<string>();
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
    }

    const senders = new Set<string>();
    let msgVpnCount = 0;
    let msgPhoneCount = 0;
    const triageCounts: Record<ContactTriageStatus, number> = {
      new: 0,
      replied: 0,
      shortlisted: 0,
      archived: 0,
    };

    for (const msg of contactMessageLogs) {
      if (msg.senderEmail) senders.add(msg.senderEmail.toLowerCase());
      if (msg.isVpnSuspected) msgVpnCount += 1;
      if (msg.senderPhone) msgPhoneCount += 1;
      triageCounts[msg.triageStatus] = (triageCounts[msg.triageStatus] ?? 0) + 1;
    }

    return {
      totalEvents: cvDownloadLogs.length,
      uniqueSessions: sessions.size,
      pdfCount,
      verifiedEmailCount: otpCount + mxCount,
      otpCount,
      vpnCount: vpnCount + msgVpnCount,
      totalMessages: contactMessageLogs.length,
      uniqueMessageSenders: senders.size,
      msgVpnCount,
      msgPhoneCount,
      triageCounts,
    };
  }, [cvDownloadLogs, contactMessageLogs]);

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

  const filteredMessages = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return contactMessageLogs.filter((msg) => {
      if (triageFilter !== 'all' && msg.triageStatus !== triageFilter) return false;
      if (msgFilter === 'vpn' && !msg.isVpnSuspected) return false;
      if (msgFilter === 'phone' && !msg.senderPhone) return false;
      if (!q) return true;
      return [
        msg.senderName,
        msg.senderEmail,
        msg.senderPhone,
        msg.subject,
        msg.message,
        msg.ownerNote,
        msg.ipAddress,
        msg.country,
        msg.city,
        msg.isp,
        msg.messageId,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [contactMessageLogs, triageFilter, msgFilter, searchTerm]);

  const activeDataset: 'downloads' | 'messages' =
    workspaceTab === 'messages' ? 'messages' : 'downloads';

  const handleExportCsv = () => {
    const isMessages = activeDataset === 'messages';
    const csv = isMessages
      ? buildCsvFromContactLogs(filteredMessages)
      : buildCsvFromDownloadLogs(filteredLogs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${
      isMessages ? 'transmitted-messages-analytics' : 'cv-download-analytics'
    }-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Run offscreen PDF capture whenever pdfRenderJob mounts
  useEffect(() => {
    if (!pdfRenderJob) return;
    let cancelled = false;

    const runCapture = async () => {
      setExportingPdf(true);
      setActionError(null);
      try {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
        await new Promise((resolve) => setTimeout(resolve, 140));

        if (cancelled) return;
        const container = pdfHostRef.current;
        if (!container) {
          throw new Error('Analytics PDF container did not mount cleanly.');
        }

        const pdfLight = pdfRenderJob.theme === 'light';
        const canvasBgHex = pdfLight ? '#ffffff' : '#06080d';
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true,
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const marginX = 9;
        const marginY = 10;
        const footerReserveMm = 9;
        const contentWidthMm = pageWidth - marginX * 2;
        const maxPageY = pageHeight - marginY - footerReserveMm;
        const maxContentHeightMm = maxPageY - marginY;
        const blockGapMm = 2.8;

        const paintPdfPage = () => {
          if (pdfLight) {
            pdf.setFillColor(255, 255, 255);
          } else {
            pdf.setFillColor(6, 8, 13);
          }
          pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        };

        paintPdfPage();
        let currentY = marginY;

        const blocks = Array.from(
          container.querySelectorAll<HTMLElement>('[data-pdf-block]')
        );
        const sliceCanvas = document.createElement('canvas');
        const sliceCtx = sliceCanvas.getContext('2d');

        for (const block of blocks) {
          if (cancelled) return;
          const rect = block.getBoundingClientRect();
          if (rect.height <= 1 || rect.width <= 1) continue;

          const blockCanvas = await html2canvas(block, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: canvasBgHex,
            logging: false,
            width: Math.round(rect.width),
            windowWidth: 1024,
            scrollX: 0,
            scrollY: 0,
          });

          const pxToMm = contentWidthMm / blockCanvas.width;
          const totalHeightMm = blockCanvas.height * pxToMm;

          if (totalHeightMm <= maxContentHeightMm) {
            if (currentY + totalHeightMm > maxPageY && currentY > marginY + 1) {
              pdf.addPage();
              paintPdfPage();
              currentY = marginY;
            }
            const imgData = blockCanvas.toDataURL('image/png');
            pdf.addImage(
              imgData,
              'PNG',
              marginX,
              currentY,
              contentWidthMm,
              totalHeightMm,
              undefined,
              'FAST'
            );
            currentY += totalHeightMm + blockGapMm;
          } else if (sliceCtx) {
            // Safely slice tall blocks along page boundaries
            const maxSlicePx = Math.floor(maxContentHeightMm / pxToMm);
            let offsetY = 0;
            while (offsetY < blockCanvas.height) {
              if (currentY > marginY + 1) {
                pdf.addPage();
                paintPdfPage();
                currentY = marginY;
              }
              const chunkPx = Math.min(maxSlicePx, blockCanvas.height - offsetY);
              sliceCanvas.width = blockCanvas.width;
              sliceCanvas.height = chunkPx;
              sliceCtx.fillStyle = canvasBgHex;
              sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
              sliceCtx.drawImage(
                blockCanvas,
                0,
                offsetY,
                blockCanvas.width,
                chunkPx,
                0,
                0,
                blockCanvas.width,
                chunkPx
              );
              const chunkData = sliceCanvas.toDataURL('image/png');
              const drawMm = chunkPx * pxToMm;
              pdf.addImage(
                chunkData,
                'PNG',
                marginX,
                currentY,
                contentWidthMm,
                drawMm,
                undefined,
                'FAST'
              );
              currentY += drawMm + blockGapMm;
              offsetY += chunkPx;
            }
          }
        }

        const totalPages = pdf.getNumberOfPages();
        for (let p = 1; p <= totalPages; p += 1) {
          pdf.setPage(p);
          if (pdfLight) {
            pdf.setDrawColor(203, 213, 225);
            pdf.setTextColor(71, 85, 105);
          } else {
            pdf.setDrawColor(30, 41, 59);
            pdf.setTextColor(148, 163, 184);
          }
          pdf.setLineWidth(0.2);
          pdf.line(marginX, pageHeight - 11, pageWidth - marginX, pageHeight - 11);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7.5);
          pdf.text(
            `Mohammed Sufyan · Owner Security & Activity Analytics (${
              pdfLight ? 'Light' : 'Dark'
            })`,
            marginX,
            pageHeight - 6
          );
          pdf.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, pageHeight - 6, {
            align: 'right',
          });
        }

        const stamp = new Date().toISOString().slice(0, 10);
        const datasetName =
          pdfRenderJob.dataset === 'messages' ? 'messages-analytics' : 'cv-analytics';
        pdf.save(`Mohammed_Sufyan_${datasetName}_${pdfRenderJob.theme}_${stamp}.pdf`);
      } catch (err) {
        if (!cancelled) {
          setActionError(
            toUserFacingError(err, 'Unable to export analytics PDF right now.')
          );
        }
      } finally {
        if (!cancelled) {
          setExportingPdf(false);
          setPdfRenderJob(null);
        }
      }
    };

    void runCapture();

    return () => {
      cancelled = true;
    };
  }, [pdfRenderJob]);

  const handleDeleteDownload = async (downloadId: string) => {
    setBusyId(downloadId);
    setActionError(null);
    try {
      await deleteCvDownloadLog(downloadId);
      setConfirmDeleteId(null);
    } catch (err) {
      setActionError(toUserFacingError(err, 'Unable to delete record.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    setBusyId(messageId);
    setActionError(null);
    try {
      await deleteContactMessageLog(messageId);
      setConfirmDeleteId(null);
    } catch (err) {
      setActionError(toUserFacingError(err, 'Unable to delete message record.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleQuickRule = async (
    key: string,
    ruleType: 'allow' | 'block',
    matchType: 'email' | 'domain' | 'ip',
    value: string,
    note: string
  ) => {
    if (!value || ruleBusyKey) return;
    setRuleBusyKey(key);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createAccessRule({ ruleType, matchType, value, note });
      setActionSuccess(
        `${ruleType === 'allow' ? 'Allowlisted' : 'Blocked'} ${matchType}: ${value}`
      );
      window.setTimeout(() => setActionSuccess(null), 3500);
    } catch (err) {
      setActionError(toUserFacingError(err, 'Unable to create rule.'));
    } finally {
      setRuleBusyKey(null);
    }
  };

  const handleTriageStatus = async (msg: ContactMessageLogRecord, nextStatus: ContactTriageStatus) => {
    const noteValue =
      triageNotesDraft[msg.messageId] !== undefined
        ? triageNotesDraft[msg.messageId]
        : msg.ownerNote;
    setSavingNoteId(msg.messageId);
    setActionError(null);
    try {
      await updateContactMessageTriage(msg.messageId, {
        triageStatus: nextStatus,
        ownerNote: noteValue,
      });
    } catch (err) {
      setActionError(toUserFacingError(err, 'Unable to update inquiry status.'));
    } finally {
      setSavingNoteId(null);
    }
  };

  const handleSaveNote = async (msg: ContactMessageLogRecord) => {
    const noteValue = triageNotesDraft[msg.messageId] ?? msg.ownerNote;
    setSavingNoteId(msg.messageId);
    setActionError(null);
    try {
      await updateContactMessageTriage(msg.messageId, {
        triageStatus: msg.triageStatus,
        ownerNote: noteValue,
      });
      setActionSuccess(`Saved private note for ${msg.messageId}`);
      window.setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setActionError(toUserFacingError(err, 'Unable to save note.'));
    } finally {
      setSavingNoteId(null);
    }
  };

  const getReplyDraft = (msg: ContactMessageLogRecord) =>
    replyDrafts[msg.messageId] || {
      subject: composeOwnerReplySubject(msg.subject || 'Portfolio inquiry'),
      body: '',
    };

  const handleSendReply = async (msg: ContactMessageLogRecord) => {
    const draft = getReplyDraft(msg);
    setReplyBusyId(msg.messageId);
    setActionError(null);
    try {
      await replyToContactMessage(msg.messageId, {
        subject: draft.subject,
        body: draft.body,
        markReplied: true,
      });
      setActionSuccess(`Reply sent to ${msg.senderEmail}`);
      setReplyDrafts((prev) => ({
        ...prev,
        [msg.messageId]: { subject: draft.subject, body: '' },
      }));
      window.setTimeout(() => setActionSuccess(null), 3500);
    } catch (err) {
      setActionError(toUserFacingError(err, 'Unable to send reply.'));
    } finally {
      setReplyBusyId(null);
    }
  };

  const getCrmDraft = (msg: ContactMessageLogRecord): LeadCrmFields => ({
    leadCompany: crmDrafts[msg.messageId]?.leadCompany ?? msg.leadCompany ?? '',
    leadRole: crmDrafts[msg.messageId]?.leadRole ?? msg.leadRole ?? '',
    leadSource: crmDrafts[msg.messageId]?.leadSource ?? msg.leadSource ?? '',
    leadPriority: crmDrafts[msg.messageId]?.leadPriority ?? msg.leadPriority ?? '',
    leadNextAction: crmDrafts[msg.messageId]?.leadNextAction ?? msg.leadNextAction ?? '',
    leadNextActionDueAtMs:
      crmDrafts[msg.messageId]?.leadNextActionDueAtMs !== undefined
        ? crmDrafts[msg.messageId]?.leadNextActionDueAtMs ?? null
        : msg.leadNextActionDueAtMs ?? null,
    leadOutcome: crmDrafts[msg.messageId]?.leadOutcome ?? msg.leadOutcome ?? '',
  });

  const handleSaveCrm = async (msg: ContactMessageLogRecord) => {
    const crm = getCrmDraft(msg);
    const noteValue = triageNotesDraft[msg.messageId] ?? msg.ownerNote;
    setSavingNoteId(msg.messageId);
    setActionError(null);
    try {
      await updateContactMessageTriage(msg.messageId, {
        triageStatus: msg.triageStatus,
        ownerNote: noteValue,
        ...crm,
      });
      setActionSuccess(`Saved CRM fields for ${msg.senderEmail}`);
      window.setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setActionError(toUserFacingError(err, 'Unable to save CRM fields.'));
    } finally {
      setSavingNoteId(null);
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

  const activeCsvCount =
    activeDataset === 'messages' ? filteredMessages.length : filteredLogs.length;

  const isAnalyticsFeed = workspaceTab === 'downloads' || workspaceTab === 'messages';

  return (
    <div className="space-y-4">
      {/* Workspace Navigation Switcher */}
      {!hideTabBar && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className={`flex flex-wrap items-center gap-1 rounded-xl border p-1 ${
              isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-[#070b14]'
            }`}
          >
            {(
              [
                ['downloads', `CV Downloads (${cvDownloadLogs.length})`, Download],
                ['messages', `Messages (${contactMessageLogs.length})`, MessageSquare],
                ['rules', `Access Rules (${accessRules.length})`, Shield],
                ['settings', 'Site Controls', SlidersHorizontal],
                ['audit', `Audit Log (${adminAuditLogs.length})`, History],
              ] as Array<[WorkspaceTab, string, typeof Download]>
            ).map(([tabKey, tabLabel, Icon]) => {
              const active = workspaceTab === tabKey;
              return (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => {
                    setWorkspaceTab(tabKey);
                    setConfirmDeleteId(null);
                    setActionError(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? tabKey === 'messages'
                        ? 'bg-[#34d399] text-slate-950 font-semibold'
                        : 'bg-[#38bdf8] text-slate-950 font-semibold'
                      : isLight
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tabLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {workspaceTab === 'rules' ? (
        <AccessRulesPanel isLight={isLight} />
      ) : workspaceTab === 'settings' ? (
        <SiteControlsPanel isLight={isLight} />
      ) : workspaceTab === 'audit' ? (
        <AdminAuditPanel isLight={isLight} />
      ) : (
        <>
          {/* KPI Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setWorkspaceTab('downloads');
                setConfirmDeleteId(null);
              }}
              className={`text-left rounded-xl border p-3 transition-colors cursor-pointer ${
                workspaceTab === 'downloads'
                  ? isLight
                    ? 'border-sky-400 bg-sky-50/70'
                    : 'border-cyan-500/60 bg-cyan-950/20'
                  : statCard
              }`}
            >
              <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase ${mutedCls}`}>
                <Download className={`w-3 h-3 ${accentCls}`} />
                <span>CV Exports</span>
              </div>
              <div className={`mt-1 text-xl font-display font-bold tabular-nums ${titleCls}`}>
                {stats.totalEvents}
              </div>
              <div className={`text-[10px] font-mono tabular-nums ${mutedCls}`}>{stats.pdfCount} PDFs</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setWorkspaceTab('messages');
                setConfirmDeleteId(null);
              }}
              className={`text-left rounded-xl border p-3 transition-colors cursor-pointer ${
                workspaceTab === 'messages'
                  ? isLight
                    ? 'border-emerald-400 bg-emerald-50/70'
                    : 'border-emerald-500/60 bg-emerald-950/20'
                  : statCard
              }`}
            >
              <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase ${mutedCls}`}>
                <MessageSquare className="w-3 h-3 text-emerald-400" />
                <span>Messages</span>
              </div>
              <div className={`mt-1 text-xl font-display font-bold tabular-nums ${titleCls}`}>
                {stats.totalMessages}
              </div>
              <div className={`text-[10px] font-mono tabular-nums ${mutedCls}`}>
                {stats.triageCounts.new} new · {stats.uniqueMessageSenders} senders
              </div>
            </button>

            <div className={`rounded-xl border p-3 ${statCard}`}>
              <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase ${mutedCls}`}>
                <Users className={`w-3 h-3 ${accentCls}`} />
                <span>CV Visitors</span>
              </div>
              <div className={`mt-1 text-xl font-display font-bold tabular-nums ${titleCls}`}>
                {stats.uniqueSessions}
              </div>
              <div className={`text-[10px] font-mono ${mutedCls}`}>Sessions tracked</div>
            </div>

            <div className={`rounded-xl border p-3 ${statCard}`}>
              <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase ${mutedCls}`}>
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Verified Leads</span>
              </div>
              <div className={`mt-1 text-xl font-display font-bold tabular-nums ${titleCls}`}>
                {stats.verifiedEmailCount}
              </div>
              <div className={`text-[10px] font-mono tabular-nums ${mutedCls}`}>
                {stats.otpCount} OTP verified
              </div>
            </div>

            <div className={`rounded-xl border p-3 col-span-2 sm:col-span-1 ${statCard}`}>
              <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase ${mutedCls}`}>
                <ShieldAlert className="w-3 h-3 text-rose-400" />
                <span>VPN / Proxy</span>
              </div>
              <div className={`mt-1 text-xl font-display font-bold tabular-nums ${titleCls}`}>
                {stats.vpnCount}
              </div>
              <div className={`text-[10px] font-mono ${mutedCls}`}>Flagged events</div>
            </div>
          </div>

          {/* Interactive Charts Suite */}
          {(cvDownloadLogs.length > 0 || contactMessageLogs.length > 0) && (
            <CvAnalyticsCharts
              logs={cvDownloadLogs}
              contactLogs={contactMessageLogs}
              activeDataset={activeDataset}
              isLight={isLight}
              activeFilter={filter}
              onSelectFilter={(next) => {
                setWorkspaceTab('downloads');
                setFilter(next);
              }}
              activeSearch={searchTerm}
              onSelectRegion={setSearchTerm}
            />
          )}

          {/* Search + CSV + Light/Dark PDF Export Controls */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="relative flex-1 min-w-[200px]">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${mutedCls}`} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  activeDataset === 'messages'
                    ? 'Search sender, email, subject, message, note, IP, country...'
                    : 'Search name, email, IP, country, ISP, format...'
                }
                className={`w-full rounded-lg border pl-8 pr-3 py-1.5 text-xs focus:outline-none ${inputCls}`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {/* PDF Theme Switcher (Light or Dark) */}
              <div
                className={`inline-flex items-center rounded-lg border p-0.5 ${
                  isLight ? 'border-slate-300 bg-slate-50' : 'border-slate-700 bg-[#070b14]'
                }`}
                title="Choose theme for exported Analytics PDF"
              >
                <button
                  type="button"
                  onClick={() => setPdfTheme('light')}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer whitespace-nowrap ${
                    pdfTheme === 'light'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold border border-slate-200'
                      : mutedCls
                  }`}
                >
                  <Sun className="w-3 h-3 text-amber-500" />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPdfTheme('dark')}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer whitespace-nowrap ${
                    pdfTheme === 'dark'
                      ? 'bg-slate-800 text-cyan-300 font-semibold'
                      : mutedCls
                  }`}
                >
                  <Moon className="w-3 h-3 text-cyan-400" />
                  <span>Dark</span>
                </button>
              </div>

              <button
                type="button"
                disabled={exportingPdf || (cvDownloadLogs.length === 0 && contactMessageLogs.length === 0)}
                onClick={() =>
                  setPdfRenderJob({
                    theme: pdfTheme,
                    dataset: activeDataset,
                  })
                }
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#38bdf8] hover:bg-sky-300 disabled:opacity-40 text-slate-950 font-semibold text-xs font-mono transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {exportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                <span>{exportingPdf ? 'Rendering PDF...' : 'Export PDF'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={activeCsvCount === 0}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0 ${
                  isLight
                    ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    : 'border-slate-700 bg-slate-900/70 text-slate-200 hover:border-cyan-500/40'
                }`}
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>CSV ({activeCsvCount})</span>
              </button>
            </div>
          </div>

          {activeDataset === 'downloads' ? (
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
          ) : (
            <div className="space-y-2">
              {/* Triage Status Pipeline Filter Tabs */}
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['all', `All Inquiries (${contactMessageLogs.length})`],
                    ['new', `New (${stats.triageCounts.new})`],
                    ['replied', `Replied (${stats.triageCounts.replied})`],
                    ['shortlisted', `Shortlisted (${stats.triageCounts.shortlisted})`],
                    ['archived', `Archived (${stats.triageCounts.archived})`],
                  ] as Array<[TriagePipelineFilter, string]>
                ).map(([key, label]) => {
                  const active = triageFilter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTriageFilter(key)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? isLight
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-800 font-semibold'
                            : 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold'
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

              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['all', 'Any Network'],
                    ['phone', `With Phone (${stats.msgPhoneCount})`],
                    ['vpn', `VPN / Risk Flagged (${stats.msgVpnCount})`],
                  ] as Array<[MessageFilter, string]>
                ).map(([key, label]) => {
                  const active = msgFilter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMsgFilter(key)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                        active
                          ? isLight
                            ? 'bg-sky-50 border-sky-400 text-sky-800'
                            : 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                          : isLight
                            ? 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                            : 'bg-[#090d16] border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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

          {actionSuccess && (
            <div
              role="status"
              className={`rounded-xl border px-3 py-2 text-xs flex items-center gap-1.5 ${
                isLight
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-emerald-500/40 bg-emerald-950/35 text-emerald-200'
              }`}
            >
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {activeDataset === 'messages' ? (
            loadingContactLogs ? (
              <div className={`py-8 flex items-center justify-center gap-2 text-xs font-mono ${mutedCls}`}>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading transmitted messages...</span>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className={`rounded-xl border p-6 text-center text-xs font-mono ${statCard} ${mutedCls}`}>
                {contactMessageLogs.length === 0
                  ? 'No transmitted messages logged yet. Inquiries submitted via the Contact form will appear here in real time.'
                  : 'No transmitted messages match your current search or pipeline filter.'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMessages.map((msg) => {
                  const ruleStatus = evaluateAccessRules(accessRules, {
                    email: msg.senderEmail,
                    ipAddress: msg.ipAddress,
                  });
                  const badgeInfo = triageBadgeStyle(msg.triageStatus, isLight);
                  const noteDraft =
                    triageNotesDraft[msg.messageId] !== undefined
                      ? triageNotesDraft[msg.messageId]
                      : msg.ownerNote;
                  const noteDirty = noteDraft !== msg.ownerNote;
                  const domain = extractDomain(msg.senderEmail);

                  return (
                    <div key={msg.messageId} className={`rounded-xl border p-3.5 space-y-2.5 ${card}`}>
                      {/* Header row */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                          <span className={`px-2 py-0.5 rounded border uppercase font-semibold ${badgeInfo.cls}`}>
                            {badgeInfo.label}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border uppercase font-semibold ${
                              msg.isVpnSuspected
                                ? isLight
                                  ? 'border-rose-300 bg-rose-50 text-rose-700'
                                  : 'border-rose-500/40 bg-rose-950/40 text-rose-300'
                                : isLight
                                  ? 'border-slate-200 bg-slate-50 text-slate-600'
                                  : 'border-slate-700 bg-slate-900/60 text-slate-300'
                            }`}
                          >
                            {msg.isVpnSuspected ? (
                              <AlertTriangle className="w-2.5 h-2.5" />
                            ) : (
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                            )}
                            <span>{msg.isVpnSuspected ? `VPN/Proxy · ${msg.riskLevel}` : 'Low Risk'}</span>
                          </span>

                          {ruleStatus.blocked && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-rose-500/40 bg-rose-950/40 text-rose-300 uppercase font-semibold">
                              <ShieldBan className="w-2.5 h-2.5" />
                              <span>BLOCKED RULE</span>
                            </span>
                          )}
                          {ruleStatus.allowlisted && !ruleStatus.blocked && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 uppercase font-semibold">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              <span>ALLOWLISTED</span>
                            </span>
                          )}

                          <span className={mutedCls}>Ref: {msg.messageId}</span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] font-mono">
                          <span className={mutedCls}>{formatTimestamp(msg.createdAtMs)}</span>

                          {confirmDeleteId === msg.messageId ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={busyId === msg.messageId}
                                onClick={() => void handleDeleteMessage(msg.messageId)}
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
                              onClick={() => setConfirmDeleteId(msg.messageId)}
                              title="Delete message record"
                              aria-label={`Delete message ${msg.messageId}`}
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

                      {/* Sender & Subject */}
                      <div>
                        <div className={`text-sm font-display font-bold ${titleCls}`}>
                          {msg.senderName}{' '}
                          <span className={`text-xs font-mono font-normal ${accentCls}`}>
                            — {msg.subject || 'Portfolio Inquiry'}
                          </span>
                        </div>
                        <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-1 ${bodyCls}`}>
                          <a
                            href={`mailto:${msg.senderEmail}?subject=${encodeURIComponent(
                              `Re: ${msg.subject || 'Portfolio Inquiry'}`
                            )}`}
                            className={`inline-flex items-center gap-1 hover:underline ${accentCls}`}
                          >
                            <Mail className="w-3 h-3" />
                            <span>{msg.senderEmail}</span>
                          </a>
                          {msg.senderPhone && (
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3" />
                              <span>{msg.senderPhone}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Message Body */}
                      <div
                        className={`rounded-lg border p-3 text-xs leading-relaxed whitespace-pre-wrap ${
                          isLight ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-slate-800/80 bg-[#070b14] text-slate-200'
                        }`}
                      >
                        {msg.message}
                      </div>

                      {/* Inquiry Triage Pipeline Controls + Private Owner Note */}
                      <div
                        className={`rounded-lg border p-2.5 space-y-2 ${
                          isLight ? 'border-slate-200 bg-slate-50/70' : 'border-slate-800/80 bg-[#060911]'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`text-[10px] font-mono uppercase ${mutedCls}`}>
                            Triage Status
                          </span>
                          <div className="flex flex-wrap items-center gap-1">
                            {CONTACT_TRIAGE_STATUSES.map((st) => {
                              const active = msg.triageStatus === st;
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  disabled={savingNoteId === msg.messageId}
                                  onClick={() => void handleTriageStatus(msg, st)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono uppercase transition-colors cursor-pointer disabled:opacity-50 ${
                                    active
                                      ? 'bg-[#38bdf8] border-[#38bdf8] text-slate-950 font-semibold'
                                      : isLight
                                        ? 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                        : 'border-slate-700 bg-slate-900/70 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {st === 'shortlisted' && <Star className="w-2.5 h-2.5" />}
                                  {st === 'replied' && <ClipboardCheck className="w-2.5 h-2.5" />}
                                  {st === 'archived' && <Archive className="w-2.5 h-2.5" />}
                                  <span>{st}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-1.5">
                          <input
                            type="text"
                            maxLength={1000}
                            value={noteDraft}
                            onChange={(e) =>
                              setTriageNotesDraft((prev) => ({
                                ...prev,
                                [msg.messageId]: e.target.value,
                              }))
                            }
                            placeholder="Add private owner follow-up note..."
                            className={`flex-1 rounded-md border px-2.5 py-1 text-xs focus:outline-none ${inputCls}`}
                          />
                          <button
                            type="button"
                            disabled={savingNoteId === msg.messageId || !noteDirty}
                            onClick={() => void handleSaveNote(msg)}
                            className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-mono transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0 ${
                              isLight
                                ? 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100'
                                : 'border-cyan-500/40 bg-cyan-950/40 text-cyan-200 hover:bg-cyan-900/60'
                            }`}
                          >
                            {savingNoteId === msg.messageId ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            <span>Save Note</span>
                          </button>
                        </div>

                        <div className="space-y-1.5 pt-1 border-t border-dashed border-slate-700/50">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={`text-[10px] font-mono uppercase ${mutedCls}`}>
                              Reply from console
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {OWNER_REPLY_TEMPLATES.map((tpl) => (
                                <button
                                  key={tpl.id}
                                  type="button"
                                  onClick={() =>
                                    setReplyDrafts((prev) => ({
                                      ...prev,
                                      [msg.messageId]: {
                                        subject: composeOwnerReplySubject(
                                          msg.subject || 'Portfolio inquiry'
                                        ),
                                        body: tpl.body,
                                      },
                                    }))
                                  }
                                  className={`px-2 py-0.5 rounded border text-[10px] font-mono cursor-pointer ${
                                    isLight
                                      ? 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                      : 'border-slate-700 bg-slate-900/70 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {tpl.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <input
                            type="text"
                            maxLength={200}
                            value={getReplyDraft(msg).subject}
                            onChange={(e) =>
                              setReplyDrafts((prev) => ({
                                ...prev,
                                [msg.messageId]: {
                                  ...getReplyDraft(msg),
                                  subject: e.target.value,
                                },
                              }))
                            }
                            placeholder="Reply subject"
                            className={`w-full rounded-md border px-2.5 py-1 text-xs focus:outline-none ${inputCls}`}
                          />
                          <textarea
                            rows={3}
                            maxLength={5000}
                            value={getReplyDraft(msg).body}
                            onChange={(e) =>
                              setReplyDrafts((prev) => ({
                                ...prev,
                                [msg.messageId]: {
                                  ...getReplyDraft(msg),
                                  body: e.target.value,
                                },
                              }))
                            }
                            placeholder="Write a reply to the visitor..."
                            className={`w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-none resize-y ${inputCls}`}
                          />
                          <button
                            type="button"
                            disabled={
                              replyBusyId === msg.messageId ||
                              getReplyDraft(msg).body.trim().length < 3
                            }
                            onClick={() => void handleSendReply(msg)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#34d399] text-slate-950 text-[11px] font-semibold cursor-pointer disabled:opacity-40"
                          >
                            {replyBusyId === msg.messageId ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Mail className="w-3 h-3" />
                            )}
                            Send reply &amp; mark Replied
                          </button>
                        </div>

                        <div className="space-y-1.5 pt-1 border-t border-dashed border-slate-700/50">
                          <span className={`text-[10px] font-mono uppercase ${mutedCls}`}>
                            Lead CRM
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            <input
                              type="text"
                              placeholder="Company"
                              value={getCrmDraft(msg).leadCompany}
                              onChange={(e) =>
                                setCrmDrafts((prev) => ({
                                  ...prev,
                                  [msg.messageId]: { ...getCrmDraft(msg), leadCompany: e.target.value },
                                }))
                              }
                              className={`rounded-md border px-2.5 py-1 text-xs focus:outline-none ${inputCls}`}
                            />
                            <input
                              type="text"
                              placeholder="Role"
                              value={getCrmDraft(msg).leadRole}
                              onChange={(e) =>
                                setCrmDrafts((prev) => ({
                                  ...prev,
                                  [msg.messageId]: { ...getCrmDraft(msg), leadRole: e.target.value },
                                }))
                              }
                              className={`rounded-md border px-2.5 py-1 text-xs focus:outline-none ${inputCls}`}
                            />
                            <select
                              value={getCrmDraft(msg).leadSource}
                              onChange={(e) =>
                                setCrmDrafts((prev) => ({
                                  ...prev,
                                  [msg.messageId]: {
                                    ...getCrmDraft(msg),
                                    leadSource: e.target.value as LeadCrmFields['leadSource'],
                                  },
                                }))
                              }
                              className={`rounded-md border px-2.5 py-1 text-xs focus:outline-none ${inputCls}`}
                            >
                              {LEAD_SOURCES.map((s) => (
                                <option key={s || 'none'} value={s}>
                                  {s ? `Source: ${s}` : 'Source: —'}
                                </option>
                              ))}
                            </select>
                            <select
                              value={getCrmDraft(msg).leadPriority}
                              onChange={(e) =>
                                setCrmDrafts((prev) => ({
                                  ...prev,
                                  [msg.messageId]: {
                                    ...getCrmDraft(msg),
                                    leadPriority: e.target.value as LeadCrmFields['leadPriority'],
                                  },
                                }))
                              }
                              className={`rounded-md border px-2.5 py-1 text-xs focus:outline-none ${inputCls}`}
                            >
                              {LEAD_PRIORITIES.map((p) => (
                                <option key={p || 'none'} value={p}>
                                  {p ? `Priority: ${p}` : 'Priority: —'}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="Next action"
                              value={getCrmDraft(msg).leadNextAction}
                              onChange={(e) =>
                                setCrmDrafts((prev) => ({
                                  ...prev,
                                  [msg.messageId]: {
                                    ...getCrmDraft(msg),
                                    leadNextAction: e.target.value,
                                  },
                                }))
                              }
                              className={`rounded-md border px-2.5 py-1 text-xs focus:outline-none ${inputCls}`}
                            />
                            <input
                              type="datetime-local"
                              value={
                                getCrmDraft(msg).leadNextActionDueAtMs
                                  ? (() => {
                                      const d = new Date(getCrmDraft(msg).leadNextActionDueAtMs!);
                                      const pad = (n: number) => String(n).padStart(2, '0');
                                      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                                    })()
                                  : ''
                              }
                              onChange={(e) =>
                                setCrmDrafts((prev) => ({
                                  ...prev,
                                  [msg.messageId]: {
                                    ...getCrmDraft(msg),
                                    leadNextActionDueAtMs: e.target.value
                                      ? new Date(e.target.value).getTime()
                                      : null,
                                  },
                                }))
                              }
                              className={`rounded-md border px-2.5 py-1 text-xs focus:outline-none ${inputCls}`}
                            />
                            <select
                              value={getCrmDraft(msg).leadOutcome}
                              onChange={(e) =>
                                setCrmDrafts((prev) => ({
                                  ...prev,
                                  [msg.messageId]: {
                                    ...getCrmDraft(msg),
                                    leadOutcome: e.target.value as LeadCrmFields['leadOutcome'],
                                  },
                                }))
                              }
                              className={`rounded-md border px-2.5 py-1 text-xs focus:outline-none sm:col-span-2 ${inputCls}`}
                            >
                              {LEAD_OUTCOMES.map((o) => (
                                <option key={o || 'none'} value={o}>
                                  {o ? `Outcome: ${o}` : 'Outcome: —'}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            disabled={savingNoteId === msg.messageId}
                            onClick={() => void handleSaveCrm(msg)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-mono cursor-pointer disabled:opacity-40 ${
                              isLight
                                ? 'border-sky-300 bg-sky-50 text-sky-800'
                                : 'border-cyan-500/40 bg-cyan-950/40 text-cyan-200'
                            }`}
                          >
                            {savingNoteId === msg.messageId ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            Save CRM
                          </button>
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
                          <span className={titleCls}>{msg.ipAddress || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <Globe2 className={`w-3 h-3 shrink-0 ${accentCls}`} />
                          <span className={mutedCls}>Geo:</span>
                          <span className={titleCls}>
                            {[msg.city, msg.region, msg.country].filter(Boolean).join(', ') || 'Unknown'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <Activity className={`w-3 h-3 shrink-0 ${accentCls}`} />
                          <span className={mutedCls}>ISP:</span>
                          <span className={bodyCls}>
                            {msg.isp || 'Unknown'} {msg.asn ? `(${msg.asn})` : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={mutedCls}>TZ:</span>
                          <span className={bodyCls}>
                            {msg.timezone || '?'} vs {msg.clientTimezone || '?'}
                          </span>
                        </div>
                      </div>

                      {/* One-Click Allowlist / Blocklist Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                        <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono ${mutedCls}`}>
                          {msg.riskReasons && <span>Signals: {msg.riskReasons}</span>}
                          {msg.referrer && <span>Source: {msg.referrer}</span>}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {domain && !ruleStatus.allowlisted && (
                            <button
                              type="button"
                              disabled={ruleBusyKey !== null}
                              onClick={() =>
                                void handleQuickRule(
                                  `${msg.messageId}-allow-dom`,
                                  'allow',
                                  'domain',
                                  domain,
                                  `Trusted via message ${msg.messageId}`
                                )
                              }
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono cursor-pointer disabled:opacity-50 ${
                                isLight
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                  : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/60'
                              }`}
                            >
                              <ShieldCheck className="w-2.5 h-2.5" />
                              <span>Allow @{domain}</span>
                            </button>
                          )}
                          {msg.senderEmail && !ruleStatus.blocked && (
                            <button
                              type="button"
                              disabled={ruleBusyKey !== null}
                              onClick={() =>
                                void handleQuickRule(
                                  `${msg.messageId}-block-email`,
                                  'block',
                                  'email',
                                  msg.senderEmail,
                                  `Blocked from inquiry ${msg.messageId}`
                                )
                              }
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono cursor-pointer disabled:opacity-50 ${
                                isLight
                                  ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                  : 'border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-950/60'
                              }`}
                            >
                              <ShieldBan className="w-2.5 h-2.5" />
                              <span>Block Email</span>
                            </button>
                          )}
                          {msg.ipAddress && msg.ipAddress !== 'Unknown' && !ruleStatus.blocked && (
                            <button
                              type="button"
                              disabled={ruleBusyKey !== null}
                              onClick={() =>
                                void handleQuickRule(
                                  `${msg.messageId}-block-ip`,
                                  'block',
                                  'ip',
                                  msg.ipAddress,
                                  `Blocked IP from inquiry ${msg.messageId}`
                                )
                              }
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono cursor-pointer disabled:opacity-50 ${
                                isLight
                                  ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                  : 'border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-950/60'
                              }`}
                            >
                              <ShieldBan className="w-2.5 h-2.5" />
                              <span>Block IP</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : loadingDownloadLogs ? (
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
              {filteredLogs.map((log) => {
                const ruleStatus = evaluateAccessRules(accessRules, {
                  email: log.visitorEmail,
                  ipAddress: log.ipAddress,
                });
                const domain = extractDomain(log.visitorEmail);

                return (
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
                          <span>{log.isVpnSuspected ? `VPN/Proxy · ${log.riskLevel}` : 'Low Risk'}</span>
                        </span>

                        {ruleStatus.blocked && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-rose-500/40 bg-rose-950/40 text-rose-300 uppercase font-semibold">
                            <ShieldBan className="w-2.5 h-2.5" />
                            <span>BLOCKED RULE</span>
                          </span>
                        )}
                        {ruleStatus.allowlisted && !ruleStatus.blocked && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 uppercase font-semibold">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            <span>ALLOWLISTED</span>
                          </span>
                        )}

                        <span className={mutedCls}>Ref: {log.downloadId}</span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-mono">
                        <span className={mutedCls}>{formatTimestamp(log.createdAtMs)}</span>

                        {confirmDeleteId === log.downloadId ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={busyId === log.downloadId}
                              onClick={() => void handleDeleteDownload(log.downloadId)}
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

                    {/* One-Click Allowlist / Blocklist Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono ${mutedCls}`}>
                        {log.riskReasons && <span>Signals: {log.riskReasons}</span>}
                        {log.referrer && <span>Source: {log.referrer}</span>}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {domain && !ruleStatus.allowlisted && (
                          <button
                            type="button"
                            disabled={ruleBusyKey !== null}
                            onClick={() =>
                              void handleQuickRule(
                                `${log.downloadId}-allow-dom`,
                                'allow',
                                'domain',
                                domain,
                                `Trusted via CV log ${log.downloadId}`
                              )
                            }
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono cursor-pointer disabled:opacity-50 ${
                              isLight
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/60'
                            }`}
                          >
                            <ShieldCheck className="w-2.5 h-2.5" />
                            <span>Allow @{domain}</span>
                          </button>
                        )}
                        {log.visitorEmail && !ruleStatus.blocked && (
                          <button
                            type="button"
                            disabled={ruleBusyKey !== null}
                            onClick={() =>
                              void handleQuickRule(
                                `${log.downloadId}-block-email`,
                                'block',
                                'email',
                                log.visitorEmail,
                                `Blocked from CV log ${log.downloadId}`
                              )
                            }
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono cursor-pointer disabled:opacity-50 ${
                              isLight
                                ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-950/60'
                            }`}
                          >
                            <ShieldBan className="w-2.5 h-2.5" />
                            <span>Block Email</span>
                          </button>
                        )}
                        {log.ipAddress && log.ipAddress !== 'Unknown' && !ruleStatus.blocked && (
                          <button
                            type="button"
                            disabled={ruleBusyKey !== null}
                            onClick={() =>
                              void handleQuickRule(
                                `${log.downloadId}-block-ip`,
                                'block',
                                'ip',
                                log.ipAddress,
                                `Blocked IP from CV log ${log.downloadId}`
                              )
                            }
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono cursor-pointer disabled:opacity-50 ${
                              isLight
                                ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-950/60'
                            }`}
                          >
                            <ShieldBan className="w-2.5 h-2.5" />
                            <span>Block IP</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Offscreen Exact-Layout PDF Snapshot Host (supports explicit Light or Dark mode) */}
      {isAnalyticsFeed &&
        pdfRenderJob &&
        typeof document !== 'undefined' &&
        createPortal(
          <AnalyticsPdfSnapshot
            hostRef={pdfHostRef}
            isLight={pdfRenderJob.theme === 'light'}
            dataset={pdfRenderJob.dataset}
            stats={stats}
            cvDownloadLogs={cvDownloadLogs}
            contactMessageLogs={contactMessageLogs}
            filteredLogs={filteredLogs}
            filteredMessages={filteredMessages}
            searchTerm={searchTerm}
          />,
          document.body
        )}
    </div>
  );
}

function AnalyticsPdfSnapshot({
  hostRef,
  isLight,
  dataset,
  stats,
  cvDownloadLogs,
  contactMessageLogs,
  filteredLogs,
  filteredMessages,
  searchTerm,
}: {
  hostRef: React.RefObject<HTMLDivElement | null>;
  isLight: boolean;
  dataset: 'downloads' | 'messages';
  stats: {
    totalEvents: number;
    uniqueSessions: number;
    pdfCount: number;
    verifiedEmailCount: number;
    otpCount: number;
    vpnCount: number;
    totalMessages: number;
    uniqueMessageSenders: number;
    triageCounts: Record<ContactTriageStatus, number>;
  };
  cvDownloadLogs: CvDownloadLogRecord[];
  contactMessageLogs: ContactMessageLogRecord[];
  filteredLogs: CvDownloadLogRecord[];
  filteredMessages: ContactMessageLogRecord[];
  searchTerm: string;
}) {
  const bgCls = isLight ? 'bg-white text-slate-900' : 'bg-[#06080d] text-slate-100';
  const statCard = isLight
    ? 'border-slate-200 bg-slate-50'
    : 'border-slate-800 bg-[#090d16]';
  const card = isLight
    ? 'border-slate-200 bg-white'
    : 'border-slate-800 bg-[#090d16]';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const bodyCls = isLight ? 'text-slate-600' : 'text-slate-300';
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const accentCls = isLight ? 'text-sky-700' : 'text-cyan-400';

  return (
    <div
      ref={hostRef}
      style={{
        position: 'fixed',
        left: '-14000px',
        top: 0,
        width: '960px',
        pointerEvents: 'none',
        zIndex: -1,
      }}
      className={`p-6 space-y-4 ${bgCls}`}
    >
      {/* Header Banner */}
      <div
        data-pdf-block
        className={`rounded-2xl border p-5 flex items-center justify-between gap-4 ${
          isLight
            ? 'border-slate-200 bg-slate-50'
            : 'border-slate-800 bg-[#0b101b]'
        }`}
      >
        <div className="space-y-1">
          <div className={`text-[11px] font-mono uppercase tracking-wider ${accentCls}`}>
            Mohammed Sufyan · Owner Security Console
          </div>
          <h2 className={`text-xl font-display font-bold ${titleCls}`}>
            Portfolio Security &amp; Activity Analytics
          </h2>
          <p className={`text-xs font-mono ${mutedCls}`}>
            Report View:{' '}
            {dataset === 'messages'
              ? `Transmitted Messages (${filteredMessages.length} records)`
              : `CV Downloads & Exports (${filteredLogs.length} records)`}
            {searchTerm ? ` · Search: "${searchTerm}"` : ''}
          </p>
        </div>
        <div className="text-right font-mono text-[11px] space-y-0.5 shrink-0">
          <div className={titleCls}>Generated: {formatTimestamp(Date.now())}</div>
          <div className={mutedCls}>Mode: {isLight ? 'Light Paper' : 'Dark Executive'}</div>
        </div>
      </div>

      {/* Exact 5-KPI Row */}
      <div data-pdf-block className="grid grid-cols-5 gap-2.5">
        <div
          className={`rounded-xl border p-3 ${
            dataset === 'downloads'
              ? isLight
                ? 'border-sky-400 bg-sky-50/70'
                : 'border-cyan-500/60 bg-cyan-950/20'
              : statCard
          }`}
        >
          <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase ${mutedCls}`}>
            <Download className={`w-3 h-3 ${accentCls}`} />
            <span>CV Exports</span>
          </div>
          <div className={`mt-1 text-xl font-display font-bold tabular-nums ${titleCls}`}>
            {stats.totalEvents}
          </div>
          <div className={`text-[10px] font-mono tabular-nums ${mutedCls}`}>{stats.pdfCount} PDFs</div>
        </div>

        <div
          className={`rounded-xl border p-3 ${
            dataset === 'messages'
              ? isLight
                ? 'border-emerald-400 bg-emerald-50/70'
                : 'border-emerald-500/60 bg-emerald-950/20'
              : statCard
          }`}
        >
          <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase ${mutedCls}`}>
            <MessageSquare className="w-3 h-3 text-emerald-500" />
            <span>Messages</span>
          </div>
          <div className={`mt-1 text-xl font-display font-bold tabular-nums ${titleCls}`}>
            {stats.totalMessages}
          </div>
          <div className={`text-[10px] font-mono tabular-nums ${mutedCls}`}>
            {stats.triageCounts.new} new · {stats.uniqueMessageSenders} senders
          </div>
        </div>

        <div className={`rounded-xl border p-3 ${statCard}`}>
          <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase ${mutedCls}`}>
            <Users className={`w-3 h-3 ${accentCls}`} />
            <span>CV Visitors</span>
          </div>
          <div className={`mt-1 text-xl font-display font-bold tabular-nums ${titleCls}`}>
            {stats.uniqueSessions}
          </div>
          <div className={`text-[10px] font-mono ${mutedCls}`}>Sessions tracked</div>
        </div>

        <div className={`rounded-xl border p-3 ${statCard}`}>
          <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase ${mutedCls}`}>
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>Verified Leads</span>
          </div>
          <div className={`mt-1 text-xl font-display font-bold tabular-nums ${titleCls}`}>
            {stats.verifiedEmailCount}
          </div>
          <div className={`text-[10px] font-mono tabular-nums ${mutedCls}`}>
            {stats.otpCount} OTP verified
          </div>
        </div>

        <div className={`rounded-xl border p-3 ${statCard}`}>
          <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase ${mutedCls}`}>
            <ShieldAlert className="w-3 h-3 text-rose-500" />
            <span>VPN / Proxy</span>
          </div>
          <div className={`mt-1 text-xl font-display font-bold tabular-nums ${titleCls}`}>
            {stats.vpnCount}
          </div>
          <div className={`text-[10px] font-mono ${mutedCls}`}>Flagged events</div>
        </div>
      </div>

      {/* Charts rendered strictly in chosen PDF theme */}
      {(cvDownloadLogs.length > 0 || contactMessageLogs.length > 0) && (
        <CvAnalyticsCharts
          logs={cvDownloadLogs}
          contactLogs={contactMessageLogs}
          activeDataset={dataset}
          isLight={isLight}
          activeFilter="all"
          onSelectFilter={() => {}}
          activeSearch=""
          onSelectRegion={() => {}}
        />
      )}

      {/* Records List */}
      <div className="space-y-3">
        {dataset === 'messages'
          ? filteredMessages.map((msg) => {
              const badgeInfo = triageBadgeStyle(msg.triageStatus, isLight);
              return (
                <div
                  key={msg.messageId}
                  data-pdf-block
                  className={`rounded-xl border p-3.5 space-y-2 ${card}`}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded border uppercase font-semibold ${badgeInfo.cls}`}>
                        {badgeInfo.label}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded border uppercase font-semibold ${
                          msg.isVpnSuspected
                            ? isLight
                              ? 'border-rose-300 bg-rose-50 text-rose-700'
                              : 'border-rose-500/40 bg-rose-950/40 text-rose-300'
                            : isLight
                              ? 'border-slate-200 bg-slate-50 text-slate-600'
                              : 'border-slate-700 bg-slate-900/60 text-slate-300'
                        }`}
                      >
                        {msg.isVpnSuspected ? `VPN/Proxy · ${msg.riskLevel}` : 'Low Risk'}
                      </span>
                      <span className={mutedCls}>Ref: {msg.messageId}</span>
                    </div>
                    <span className={mutedCls}>{formatTimestamp(msg.createdAtMs)}</span>
                  </div>

                  <div>
                    <div className={`text-sm font-display font-bold ${titleCls}`}>
                      {msg.senderName}{' '}
                      <span className={`text-xs font-mono font-normal ${accentCls}`}>
                        — {msg.subject || 'Portfolio Inquiry'}
                      </span>
                    </div>
                    <div className={`flex flex-wrap items-center gap-3 text-xs mt-0.5 ${bodyCls}`}>
                      <span>{msg.senderEmail}</span>
                      {msg.senderPhone && <span className="font-mono">{msg.senderPhone}</span>}
                    </div>
                  </div>

                  <div
                    className={`rounded-lg border p-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      isLight
                        ? 'border-slate-200 bg-slate-50 text-slate-700'
                        : 'border-slate-800/80 bg-[#070b14] text-slate-200'
                    }`}
                  >
                    {msg.message}
                  </div>

                  {msg.ownerNote && (
                    <div className={`text-xs font-mono ${mutedCls}`}>
                      Owner Note: <span className={bodyCls}>{msg.ownerNote}</span>
                    </div>
                  )}

                  <div
                    className={`grid grid-cols-2 gap-1.5 rounded-lg border p-2 text-[11px] font-mono ${
                      isLight
                        ? 'border-slate-200 bg-slate-50/70'
                        : 'border-slate-800/80 bg-[#060911]'
                    }`}
                  >
                    <div>
                      <span className={mutedCls}>IP: </span>
                      <span className={titleCls}>{msg.ipAddress || 'Unknown'}</span>
                    </div>
                    <div>
                      <span className={mutedCls}>Geo: </span>
                      <span className={titleCls}>
                        {[msg.city, msg.region, msg.country].filter(Boolean).join(', ') || 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <span className={mutedCls}>ISP: </span>
                      <span className={bodyCls}>
                        {msg.isp || 'Unknown'} {msg.asn ? `(${msg.asn})` : ''}
                      </span>
                    </div>
                    <div>
                      <span className={mutedCls}>TZ: </span>
                      <span className={bodyCls}>
                        {msg.timezone || '?'} vs {msg.clientTimezone || '?'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          : filteredLogs.map((log) => (
              <div
                key={log.downloadId}
                data-pdf-block
                className={`rounded-xl border p-3.5 space-y-2 ${card}`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded border uppercase font-semibold ${
                        log.verificationStatus === 'otp_verified'
                          ? isLight
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                          : isLight
                            ? 'border-sky-300 bg-sky-50 text-sky-800'
                            : 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300'
                      }`}
                    >
                      {formatVerifyTag(log.verificationStatus)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded border uppercase font-semibold ${
                        log.isVpnSuspected
                          ? isLight
                            ? 'border-rose-300 bg-rose-50 text-rose-700'
                            : 'border-rose-500/40 bg-rose-950/40 text-rose-300'
                          : isLight
                            ? 'border-slate-200 bg-slate-50 text-slate-600'
                            : 'border-slate-700 bg-slate-900/60 text-slate-300'
                      }`}
                    >
                      {log.isVpnSuspected ? `VPN/Proxy · ${log.riskLevel}` : 'Low Risk'}
                    </span>
                    <span className={mutedCls}>Ref: {log.downloadId}</span>
                  </div>
                  <span className={mutedCls}>{formatTimestamp(log.createdAtMs)}</span>
                </div>

                <div>
                  <div className={`text-sm font-display font-bold ${titleCls}`}>
                    {log.visitorName || 'Anonymous Visitor'}{' '}
                    <span className={`text-xs font-mono font-normal ${accentCls}`}>
                      — {log.formatLabel} ({log.action.toUpperCase()})
                    </span>
                  </div>
                  <div className={`flex flex-wrap items-center gap-3 text-xs mt-0.5 ${bodyCls}`}>
                    {log.visitorEmail && <span>{log.visitorEmail}</span>}
                    {log.visitorPhone && <span className="font-mono">{log.visitorPhone}</span>}
                  </div>
                </div>

                <div
                  className={`grid grid-cols-2 gap-1.5 rounded-lg border p-2 text-[11px] font-mono ${
                    isLight
                      ? 'border-slate-200 bg-slate-50/70'
                      : 'border-slate-800/80 bg-[#060911]'
                  }`}
                >
                  <div>
                    <span className={mutedCls}>IP: </span>
                    <span className={titleCls}>{log.ipAddress || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className={mutedCls}>Geo: </span>
                    <span className={titleCls}>
                      {[log.city, log.region, log.country].filter(Boolean).join(', ') || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className={mutedCls}>ISP: </span>
                    <span className={bodyCls}>
                      {log.isp || 'Unknown'} {log.asn ? `(${log.asn})` : ''}
                    </span>
                  </div>
                  <div>
                    <span className={mutedCls}>TZ: </span>
                    <span className={log.timezoneMismatch ? 'text-rose-500 font-semibold' : bodyCls}>
                      {log.timezone || '?'} vs {log.clientTimezone || '?'}
                    </span>
                  </div>
                </div>

                <div className={`text-xs ${bodyCls}`}>
                  <span className={`font-mono text-[10px] uppercase mr-1.5 ${mutedCls}`}>
                    Reason:
                  </span>
                  {log.reason}
                </div>
              </div>
            ))}
      </div>
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
            className={`relative w-full max-w-4xl 2xl:max-w-5xl max-h-[min(calc(100dvh-1.5rem),36rem)] sm:max-h-[min(calc(100dvh-2.5rem),42rem)] lg:max-h-[min(calc(100dvh-3rem),54rem)] overflow-hidden rounded-2xl border shadow-2xl flex flex-col ${panel}`}
          >
            <div className="relative flex items-start justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800/90 bg-[#0b101b] shrink-0">
              <ModalHeaderScan active={isOpen} />
              <div className="relative flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-display font-bold text-white">
                    Portfolio Security &amp; Governance Console
                  </h3>
                  <p className="text-[11px] sm:text-xs font-mono text-cyan-400/90">
                    Owner-only analytics, Light/Dark PDF export, inquiry triage, rules &amp; audit trail
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
