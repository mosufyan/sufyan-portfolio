import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Linkedin,
  Mail,
  MapPin,
  QrCode,
  UserPlus,
  X,
} from 'lucide-react';
import { PERSONAL_INFO } from '../data/portfolioData';
import { buildVCardString, downloadVCard, PORTFOLIO_CANONICAL_URL } from '../utils/vcard';
import { EASE_OUT_EXPO } from './MotionPrimitives';

interface DigitalCardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type QrMode = 'url' | 'vcard';

export default function DigitalCardModal({ isOpen, onClose }: DigitalCardModalProps) {
  const [qrMode, setQrMode] = useState<QrMode>('url');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [vcfSaved, setVcfSaved] = useState(false);

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

  return (
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto print:hidden"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl border border-slate-700/80 bg-[#080b13] shadow-2xl overflow-hidden my-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800/90 bg-[#0b101b]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-white text-sm sm:text-base">
                    Digital Business Card
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    One-tap contact save or scan QR on mobile
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

            <div className="p-5 space-y-5">
              {/* Executive Identity Pass */}
              <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-[#0d1424] via-[#0a101d] to-[#070b14] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-cyan-500/35 bg-[#06080d] shrink-0">
                    <img
                      src="/assets/aistudio/Sufyan_hero_portrait.png"
                      alt="Mohammed Sufyan"
                      className="w-full h-full object-contain object-bottom"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-bold text-white text-base leading-tight">
                      {PERSONAL_INFO.name}
                    </div>
                    <div className="text-[11px] font-mono text-cyan-400 mt-0.5 leading-snug">
                      Cisco STO · Principal Cloud Solutions Architect
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-800/80 space-y-1.5 text-xs font-mono text-slate-300">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate">{PERSONAL_INFO.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <a
                      href={`mailto:${PERSONAL_INFO.email}`}
                      className="hover:text-cyan-300 truncate"
                    >
                      {PERSONAL_INFO.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-cyan-300 truncate">www.mohammedsufyan.com</span>
                  </div>
                </div>
              </div>

              {/* QR Mode Toggle + Crisp Frame */}
              <div className="flex flex-col items-center space-y-3">
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0d121f] border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setQrMode('url')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${
                      qrMode === 'url'
                        ? 'bg-cyan-500 text-slate-950 font-semibold'
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
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Instant Contact QR
                  </button>
                </div>

                <div className="p-3 rounded-2xl bg-white border-2 border-cyan-500/30 shadow-lg">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={
                        qrMode === 'url'
                          ? 'QR code for https://www.mohammedsufyan.com/'
                          : 'vCard QR code for Mohammed Sufyan'
                      }
                      className="w-44 h-44 sm:w-48 sm:h-48 block"
                    />
                  ) : (
                    <div className="w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center text-xs font-mono text-slate-500">
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
                <button
                  type="button"
                  onClick={handleDownloadVcf}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#38bdf8] hover:bg-sky-300 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-sky-500/20 cursor-pointer"
                >
                  {vcfSaved ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Saved .vcf!</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Save Contact (.vcf)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadQrPng}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-200 hover:text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>Download QR PNG</span>
                </button>
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
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
