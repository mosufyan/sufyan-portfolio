import { Linkedin } from './icons/Linkedin';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Mail,
  MapPin,
  QrCode,
  UserPlus,
  X
} from 'lucide-react';
import { PERSONAL_INFO } from '../data/portfolioData';
import { useTheme } from '../theme/ThemeProvider';
import { buildVCardString, downloadVCard, PORTFOLIO_CANONICAL_URL } from '../utils/vcard';
import { SHARE_CARD_TRACKS, type ShareTrackId } from '../utils/ogShare';
import { renderSocialShareCardPng } from '../utils/socialShareCardCanvas';
import { useModalPlacement } from '../hooks/useModalPlacement';
import BrandMark from './BrandMark';
import ModalHeaderScan from './ModalHeaderScan';
import { EASE_OUT_EXPO } from './MotionPrimitives';
import ShineSurface from './ShineSurface';
import ThemeSymbol from './ThemeSymbol';

interface DigitalCardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type QrMode = 'url' | 'vcard';
type ModalTab = 'qr' | 'social';

export default function DigitalCardModal({ isOpen, onClose }: DigitalCardModalProps) {
  const { isLight, accent: siteAccent } = useTheme();
  const alignClass = useModalPlacement(isOpen);
  const [activeTab, setActiveTab] = useState<ModalTab>('qr');
  const [qrMode, setQrMode] = useState<QrMode>('url');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [vcfSaved, setVcfSaved] = useState(false);
  const [shareTrack, setShareTrack] = useState<ShareTrackId>('executive');
  const [shareCardTheme, setShareCardTheme] = useState<'dark' | 'light'>(() =>
    isLight ? 'light' : 'dark'
  );
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [downloadingBanner, setDownloadingBanner] = useState(false);
  const [sharePreviewUrl, setSharePreviewUrl] = useState('');
  const [sharePreviewLoading, setSharePreviewLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShareCardTheme(isLight ? 'light' : 'dark');
    }
  }, [isOpen, isLight]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const payload = qrMode === 'url' ? PORTFOLIO_CANONICAL_URL : buildVCardString();

    QRCode.toDataURL(payload, {
      width: 440,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#06080d',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });

    return () => {
      active = false;
    };
  }, [isOpen, qrMode]);

  const handleDownloadVcf = () => {
    downloadVCard();
    setVcfSaved(true);
    window.setTimeout(() => setVcfSaved(false), 2400);
  };

  const handleDownloadQrPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download =
      qrMode === 'url' ? 'Mohammed_Sufyan_Portfolio_QR.png' : 'Mohammed_Sufyan_Contact_QR.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyUrl = () => {
    navigator.clipboard
      ?.writeText(PORTFOLIO_CANONICAL_URL)
      .then(() => {
        setCopiedUrl(true);
        window.setTimeout(() => setCopiedUrl(false), 2000);
      })
      .catch(() => {});
  };

  const activeShareTrack =
    SHARE_CARD_TRACKS.find((t) => t.id === shareTrack) ?? SHARE_CARD_TRACKS[0];

  useEffect(() => {
    if (!isOpen || activeTab !== 'social') return;
    let active = true;
    setSharePreviewLoading(true);
    renderSocialShareCardPng({
      track: activeShareTrack,
      theme: shareCardTheme,
      accent: siteAccent === 'amber' ? 'amber' : 'cyan',
    })
      .then((url) => {
        if (!active) return;
        setSharePreviewUrl(url || '');
        setSharePreviewLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSharePreviewUrl('');
        setSharePreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, activeTab, activeShareTrack, shareCardTheme, siteAccent]);

  const handleCopyTrackShareUrl = () => {
    const base =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : PORTFOLIO_CANONICAL_URL.replace(/\/$/, '');
    const targetUrl = `${base}${activeShareTrack.shareQuery || `?track=${activeShareTrack.id}&theme=${shareCardTheme}`}`;
    navigator.clipboard
      ?.writeText(targetUrl)
      .then(() => {
        setCopiedShareLink(true);
        window.setTimeout(() => setCopiedShareLink(false), 2000);
      })
      .catch(() => {});
  };

  const handleDownloadSocialPng = async () => {
    if (downloadingBanner) return;
    setDownloadingBanner(true);
    try {
      const pngUrl =
        sharePreviewUrl ||
        (await renderSocialShareCardPng({
          track: activeShareTrack,
          theme: shareCardTheme,
          accent: siteAccent === 'amber' ? 'amber' : 'cyan',
        }));
      if (!pngUrl) return;
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `Mohammed_Sufyan_${activeShareTrack.id}_Share_Card.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloadingBanner(false);
    }
  };

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Digital Business Card and QR Code"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className={`site-overlay fixed inset-0 z-50 flex ${alignClass} justify-center p-2.5 sm:p-5 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-black/80 backdrop-blur-md overflow-y-auto print:hidden`}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-lg 2xl:max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[min(calc(100dvh-1.5rem),35.5rem)] sm:max-h-[min(calc(100dvh-2.5rem),36rem)] lg:max-h-[min(calc(100dvh-3rem),46rem)] ${
              isLight
                ? 'border border-slate-200 bg-white'
                : 'border border-slate-700/80 bg-[#080b13]'
            }`}
          >
            {/* Header — always dark for brand consistency */}
            <div className="relative shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5 border-b border-slate-800/90 bg-[#0b101b]">
              <ModalHeaderScan active={isOpen} />
              <div className="flex items-center gap-2.5">
                <BrandMark size="sm" />
                <div>
                  <h3 className="font-display font-bold text-sm sm:text-base text-white">
                    Digital Card &amp; Social Share Studio
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    {activeTab === 'qr'
                      ? 'One-tap contact save or scan QR on mobile'
                      : 'Custom 1200×630 LinkedIn & Slack share cards'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close digital business card"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-5 space-y-3 sm:space-y-4">
              {/* Top Mode Switcher */}
              <div
                className={`grid grid-cols-2 gap-1 p-1 rounded-xl border ${
                  isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#0d121f] border-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('qr')}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                    activeTab === 'qr'
                      ? isLight
                        ? 'bg-sky-600 text-white font-semibold'
                        : 'bg-cyan-500 text-slate-950 font-semibold'
                      : isLight
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Contact QR &amp; .vcf</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('social')}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                    activeTab === 'social'
                      ? isLight
                        ? 'bg-sky-600 text-white font-semibold'
                        : 'bg-cyan-500 text-slate-950 font-semibold'
                      : isLight
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Social Share Card</span>
                </button>
              </div>

              {activeTab === 'social' ? (
                <div className="space-y-4">
                  {/* Track & Theme Selector */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {SHARE_CARD_TRACKS.map((tr) => {
                        const active = shareTrack === tr.id;
                        return (
                          <button
                            key={tr.id}
                            type="button"
                            onClick={() => setShareTrack(tr.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors cursor-pointer ${
                              active
                                ? isLight
                                  ? 'bg-sky-600 border-sky-600 text-white font-semibold'
                                  : 'bg-cyan-500 border-cyan-500 text-slate-950 font-semibold'
                                : isLight
                                  ? 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300'
                                  : 'border-slate-800 bg-[#0d121f] text-slate-300 hover:border-cyan-500/40'
                            }`}
                          >
                            {tr.label}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setShareCardTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
                      }
                      title={
                        shareCardTheme === 'light'
                          ? 'Switch share card preview to Dark Theme'
                          : 'Switch share card preview to Light Paper'
                      }
                      aria-label={
                        shareCardTheme === 'light'
                          ? 'Switch share card preview to Dark Theme'
                          : 'Switch share card preview to Light Paper'
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono border transition-colors cursor-pointer overflow-hidden ${
                        shareCardTheme === 'light'
                          ? isLight
                            ? 'border-amber-400/70 bg-amber-50 text-amber-800 hover:bg-amber-100'
                            : 'border-amber-400/60 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                          : isLight
                            ? 'border-slate-300 bg-slate-100 text-slate-800 hover:border-sky-400'
                            : 'border-slate-700/90 bg-slate-900/70 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40'
                      }`}
                    >
                      <ThemeSymbol
                        isLight={shareCardTheme === 'light'}
                        sunColorClass={isLight ? 'text-amber-600' : 'text-amber-300'}
                        moonColorClass={isLight ? 'text-sky-600' : 'text-cyan-400'}
                        keyPrefix="share-card"
                      />
                      <span>{shareCardTheme === 'light' ? 'Light Paper' : 'Dark Theme'}</span>
                    </button>
                  </div>

                  {/* Live preview = exact same canvas PNG as download */}
                  <div
                    className={`aspect-[1200/630] w-full rounded-xl border overflow-hidden relative ${
                      shareCardTheme === 'light'
                        ? 'border-slate-200 bg-slate-100'
                        : 'border-slate-800 bg-[#06080d]'
                    }`}
                  >
                    {sharePreviewUrl ? (
                      <img
                        src={sharePreviewUrl}
                        alt={`${activeShareTrack.label} social share card preview`}
                        className="absolute inset-0 h-full w-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div
                        className={`absolute inset-0 flex items-center justify-center text-[11px] font-mono ${
                          shareCardTheme === 'light' ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        {sharePreviewLoading ? 'Rendering preview…' : 'Preview unavailable'}
                      </div>
                    )}
                  </div>

                  {/* Social Share Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <ShineSurface className="rounded-xl w-full" shineClassName="via-white/45">
                      <button
                        type="button"
                        onClick={handleDownloadSocialPng}
                        disabled={downloadingBanner}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-cyan-500/20 cursor-pointer disabled:opacity-60"
                      >
                        <Download className="w-4 h-4" />
                        <span>{downloadingBanner ? 'Rendering PNG...' : 'Download 1200×630 PNG'}</span>
                      </button>
                    </ShineSurface>

                    <button
                      type="button"
                      onClick={handleCopyTrackShareUrl}
                      className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-xs transition-colors cursor-pointer ${
                        isLight
                          ? 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
                          : 'border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-200 hover:text-white'
                      }`}
                    >
                      {copiedShareLink ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Share Link Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className={`w-4 h-4 ${isLight ? 'text-sky-700' : 'text-cyan-400'}`} />
                          <span>Copy Track URL</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <>
              {/* Executive Identity Pass */}
              <div
                className={`rounded-xl border p-3 sm:p-3.5 space-y-2 ${
                  isLight
                    ? 'border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50'
                    : 'border-slate-800 bg-gradient-to-br from-[#0d1424] via-[#0a101d] to-[#070b14]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 ${
                      isLight
                        ? 'border border-sky-200 bg-slate-100'
                        : 'border border-cyan-500/35 bg-[#06080d]'
                    }`}
                  >
                    <img
                      src="/assets/aistudio/Sufyan_hero_portrait.png"
                      alt="Mohammed Sufyan"
                      className="w-full h-full object-contain object-bottom"
                    />
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`font-display font-bold text-base leading-tight ${
                        isLight ? 'text-slate-900' : 'text-white'
                      }`}
                    >
                      {PERSONAL_INFO.name}
                    </div>
                    <div
                      className={`text-[11px] font-mono mt-0.5 leading-snug ${
                        isLight ? 'text-sky-700' : 'text-cyan-400'
                      }`}
                    >
                      <span className="sm:hidden">Cisco</span>
                      <span className="hidden sm:inline">Cisco Systems Inc.</span>
                      {' '}STO · Software Engineer
                    </div>
                  </div>
                </div>

                <div
                  className={`pt-2.5 space-y-1.5 text-xs font-mono ${
                    isLight
                      ? 'border-t border-slate-200 text-slate-600'
                      : 'border-t border-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-sky-700' : 'text-cyan-400'}`} />
                    <span className="truncate">{PERSONAL_INFO.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-sky-700' : 'text-cyan-400'}`} />
                    <a
                      href={`mailto:${PERSONAL_INFO.email}`}
                      className={`truncate ${isLight ? 'hover:text-sky-800' : 'hover:text-cyan-300'}`}
                    >
                      {PERSONAL_INFO.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-sky-700' : 'text-cyan-400'}`} />
                    <span className={`truncate ${isLight ? 'text-sky-700' : 'text-cyan-300'}`}>
                      www.mohammedsufyan.com
                    </span>
                  </div>
                </div>
              </div>

              {/* QR Mode Toggle + Crisp Frame */}
              <div className="flex flex-col items-center space-y-3">
                <div
                  className={`inline-flex items-center gap-1 p-1 rounded-xl border ${
                    isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#0d121f] border-slate-800'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setQrMode('url')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${
                      qrMode === 'url'
                        ? 'bg-cyan-500 text-slate-950 font-semibold'
                        : isLight
                          ? 'text-slate-500 hover:text-slate-900'
                          : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Website QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrMode('vcard')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${
                      qrMode === 'vcard'
                        ? 'bg-cyan-500 text-slate-950 font-semibold'
                        : isLight
                          ? 'text-slate-500 hover:text-slate-900'
                          : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Instant Contact QR
                  </button>
                </div>

                <div className="p-2.5 sm:p-3 rounded-2xl bg-white border-2 border-cyan-500/30 shadow-lg">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={
                        qrMode === 'url'
                          ? 'QR code for https://www.mohammedsufyan.com/'
                          : 'vCard QR code for Mohammed Sufyan'
                      }
                      className="w-36 h-36 sm:w-44 sm:h-44 lg:w-48 lg:h-48 block"
                    />
                  ) : (
                    <div className="w-36 h-36 sm:w-44 sm:h-44 lg:w-48 lg:h-48 flex items-center justify-center text-xs font-mono text-slate-500">
                      Generating QR...
                    </div>
                  )}
                </div>

                <p className="text-[11px] font-mono text-slate-400 text-center">
                  {qrMode === 'url'
                    ? 'Scan with any camera to open www.mohammedsufyan.com'
                    : 'Scan to add Mohammed Sufyan directly to phone Contacts'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <ShineSurface className="rounded-xl w-full" shineClassName="via-white/45">
                  <button
                    type="button"
                    onClick={handleDownloadVcf}
                    className="relative w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-cyan-500/20 cursor-pointer overflow-hidden"
                  >
                    {vcfSaved ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Saved .vcf!</span>
                        <motion.span
                          aria-hidden="true"
                          initial={{ scale: 0.4, opacity: 0.7 }}
                          animate={{ scale: 2.3, opacity: 0 }}
                          transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
                          className="pointer-events-none absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/70"
                        />
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Save Contact (.vcf)</span>
                      </>
                    )}
                  </button>
                </ShineSurface>

                <ShineSurface
                  className="rounded-xl w-full"
                  shineClassName={isLight ? 'via-sky-300/35' : 'via-cyan-200/25'}
                >
                  <button
                    type="button"
                    onClick={handleDownloadQrPng}
                    className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-xs transition-colors cursor-pointer ${
                      isLight
                        ? 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
                        : 'border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-200 hover:text-white'
                    }`}
                  >
                    <Download className={`w-4 h-4 ${isLight ? 'text-sky-700' : 'text-cyan-400'}`} />
                    <span>Download QR PNG</span>
                  </button>
                </ShineSurface>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="inline-flex items-center gap-1.5 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">URL Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Copy www.mohammedsufyan.com</span>
                    </>
                  )}
                </button>

                <a
                  href={PERSONAL_INFO.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                >
                  <Linkedin className="w-3.5 h-3.5" />
                  <span>LinkedIn</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
