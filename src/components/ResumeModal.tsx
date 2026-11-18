import { Linkedin } from './icons/Linkedin';
import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { AnimatePresence, motion } from 'motion/react';
import ModalHeaderScan from './ModalHeaderScan';
import { EASE_OUT_EXPO } from './MotionPrimitives';
import ShineSurface from './ShineSurface';
import {
  X,
  Printer,
  Download,
  Mail,
  MapPin,
  Globe,
  ExternalLink,
  Compass,
  Briefcase,
  Building2,
  Calendar,
  Award,
  Cpu,
  CheckCircle2,
  Sparkles,
  Terminal,
  Server,
  Layers,
  Shield,
  Activity,
  CheckCircle,
  Trophy,
  Star,
  Medal,
  GraduationCap,
  Loader2,
  Check,
  SlidersHorizontal,
  Sun,
  Moon,
  Quote,
  Copy
} from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';
import {
  PERSONAL_INFO,
  STATS,
  TECHNICAL_DISCIPLINES,
  WORK_EXPERIENCE,
  CERTIFICATION_CATEGORIES,
  CERTIFICATIONS,
  AWARDS_BY_ORGANIZATION,
  AWARDS,
  LINKEDIN_RECOMMENDATIONS,
  EDUCATION
} from '../data/portfolioData';
import { buildAtsPlainTextResume } from '../utils/atsFormatter';
import AccessGateModal, {
  isAccessUnlocked,
  type AccessGateAction,
} from './AccessGateModal';
import IssuerMark from './IssuerMark';

interface ResumeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PresetMode = 'summary' | 'concise' | 'full' | 'security' | 'platform' | 'fullstack' | 'custom';
type ExperienceDepth = 'compact' | 'concise' | 'full';
type SkillsDepth = 'compact' | 'full';
type CertsDepth = 'top6' | 'top8' | 'full';
type AwardsDepth = 'featured' | 'full';

interface ExportConfig {
  sections: {
    overview: boolean;
    philosophy: boolean;
    experience: boolean;
    skills: boolean;
    certifications: boolean;
    awards: boolean;
    education: boolean;
  };
  experienceDepth: ExperienceDepth;
  skillsDepth: SkillsDepth;
  certsDepth: CertsDepth;
  awardsDepth: AwardsDepth;
}

const PRESETS: Record<'summary' | 'concise' | 'full' | 'security' | 'platform' | 'fullstack', ExportConfig> = {
  summary: {
    sections: {
      overview: true,
      philosophy: false,
      experience: true,
      skills: true,
      certifications: true,
      awards: false,
      education: true
    },
    experienceDepth: 'compact',
    skillsDepth: 'compact',
    certsDepth: 'top6',
    awardsDepth: 'featured'
  },
  concise: {
    sections: {
      overview: true,
      philosophy: true,
      experience: true,
      skills: true,
      certifications: true,
      awards: true,
      education: true
    },
    experienceDepth: 'concise',
    skillsDepth: 'full',
    certsDepth: 'top8',
    awardsDepth: 'featured'
  },
  full: {
    sections: {
      overview: true,
      philosophy: true,
      experience: true,
      skills: true,
      certifications: true,
      awards: true,
      education: true
    },
    experienceDepth: 'full',
    skillsDepth: 'full',
    certsDepth: 'full',
    awardsDepth: 'full'
  },
  security: {
    sections: {
      overview: true,
      philosophy: true,
      experience: true,
      skills: true,
      certifications: true,
      awards: true,
      education: true
    },
    experienceDepth: 'concise',
    skillsDepth: 'full',
    certsDepth: 'top8',
    awardsDepth: 'featured'
  },
  platform: {
    sections: {
      overview: true,
      philosophy: false,
      experience: true,
      skills: true,
      certifications: true,
      awards: true,
      education: true
    },
    experienceDepth: 'full',
    skillsDepth: 'full',
    certsDepth: 'top8',
    awardsDepth: 'featured'
  },
  fullstack: {
    sections: {
      overview: true,
      philosophy: false,
      experience: true,
      skills: true,
      certifications: true,
      awards: false,
      education: true
    },
    experienceDepth: 'concise',
    skillsDepth: 'full',
    certsDepth: 'top6',
    awardsDepth: 'featured'
  },
};

const FEATURED_CERT_IDS_SUMMARY = new Set([
  'cert-house-of-edtech-ai',
  'cert-db-ai-agent',
  'cert-aws-devops-pro',
  'cert-aws-saa',
  'cert-google-ace',
  'cert-ms-devops-expert'
]);

const FEATURED_CERT_IDS_CONCISE = new Set([
  'cert-house-of-edtech-ai',
  'cert-be10x-ai',
  'cert-db-ai-agent',
  'cert-google-genai',
  'cert-aws-devops-pro',
  'cert-aws-saa',
  'cert-google-ace',
  'cert-ms-devops-expert'
]);

const FEATURED_AWARD_IDS = new Set([
  'award-cisco-ptw-sep2026',
  'award-cisco-ptw-aug2026',
  'award-hcl-kc-mar2026',
  'award-hcl-star-mar2025',
  'award-hcl-achieve-o4',
  'award-hcl-spark-apr2021',
  'award-tcs-service-2019',
  'award-tcs-spot-2017'
]);

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export default function ResumeModal({ isOpen, onClose }: ResumeModalProps) {
  const { theme: siteTheme } = useTheme();
  const contentRef = useRef<HTMLDivElement>(null);
  const [preset, setPreset] = useState<PresetMode>('summary');
  const [config, setConfig] = useState<ExportConfig>(PRESETS.summary);
  const [cvTheme, setCvTheme] = useState<'dark' | 'light'>(siteTheme);
  const isLight = cvTheme === 'light';

  const [showCustomize, setShowCustomize] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [atsCopied, setAtsCopied] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [cvUnlocked, setCvUnlocked] = useState<boolean>(() => isAccessUnlocked('pdf'));
  const [pendingAction, setPendingAction] = useState<AccessGateAction | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCvTheme(siteTheme);
    } else {
      setPendingAction(null);
    }
  }, [isOpen, siteTheme]);

  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.setAttribute('data-cv-print-theme', cvTheme);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingAction !== null) {
          setPendingAction(null);
          return;
        }
        if (!isGeneratingPdf) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.removeAttribute('data-cv-print-theme');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isGeneratingPdf, pendingAction, cvTheme, onClose]);

  const applyPreset = (mode: keyof typeof PRESETS) => {
    setPreset(mode);
    setConfig(PRESETS[mode]);
  };

  const toggleSection = (key: keyof ExportConfig['sections']) => {
    setPreset('custom');
    setConfig((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [key]: !prev.sections[key]
      }
    }));
  };

  const selectedSectionCount = Object.values(config.sections).filter(Boolean).length;

  const pillars = [
    'ARCHITECTURAL LEADERSHIP',
    'CLOUD-NATIVE SERVICES & SCALE DEV',
    'HIGH CONCURRENCY RESILIENCE',
    'CITIZEN AI ARCHITECTS',
    'DEVOPS, SRE & DISTRIBUTED SYSTEMS'
  ];

  const getDisciplineIcon = (id: string) => {
    switch (id) {
      case 'ai-genai':
        return <Sparkles className={`w-4 h-4 ${isLight ? 'text-purple-600' : 'text-purple-400'}`} />;
      case 'python-scripting':
        return <Terminal className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-yellow-400'}`} />;
      case 'cloud-platforms':
        return <Server className={`w-4 h-4 ${isLight ? 'text-sky-600' : 'text-sky-400'}`} />;
      case 'devops-containers':
        return <Layers className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />;
      case 'security-governance':
        return <Shield className={`w-4 h-4 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />;
      case 'observability-telemetry':
        return <Activity className={`w-4 h-4 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />;
      default:
        return <Cpu className={`w-4 h-4 ${isLight ? 'text-sky-700' : 'text-cyan-400'}`} />;
    }
  };

  // Derive filtered/scoped data based on selected preset or custom options
  const visibleExperience = WORK_EXPERIENCE.map((comp) => {
    if (config.experienceDepth === 'compact') {
      const roleLimit = comp.company.includes('HCL') ? 2 : 1;
      return {
        ...comp,
        roles: comp.roles.slice(0, roleLimit).map((r) => ({
          ...r,
          highlights: r.highlights.slice(0, 2)
        }))
      };
    }
    if (config.experienceDepth === 'concise') {
      return {
        ...comp,
        roles: comp.roles.map((r) => ({
          ...r,
          highlights: r.highlights.slice(0, 3)
        }))
      };
    }
    return comp;
  });

  const totalRoleCount = WORK_EXPERIENCE.reduce((acc, comp) => acc + comp.roles.length, 0);

  const visibleCertCategories =
    config.certsDepth === 'full'
      ? CERTIFICATION_CATEGORIES
      : [
          {
            id: 'featured',
            name: 'Flagship Cloud, AI & Architecture Credentials',
            certs: CERTIFICATIONS.filter((c) =>
              (config.certsDepth === 'top6' ? FEATURED_CERT_IDS_SUMMARY : FEATURED_CERT_IDS_CONCISE).has(c.id)
            )
          }
        ];

  const visibleAwardsGroups =
    config.awardsDepth === 'featured'
      ? AWARDS_BY_ORGANIZATION.map((group) => ({
          ...group,
          awards: group.awards.filter((a) => FEATURED_AWARD_IDS.has(a.id))
        })).filter((g) => g.awards.length > 0)
      : AWARDS_BY_ORGANIZATION;

  const visibleRecommendations =
    config.awardsDepth === 'featured'
      ? LINKEDIN_RECOMMENDATIONS.filter((rec) => rec.featured)
      : LINKEDIN_RECOMMENDATIONS;
  const recommendationRows = chunkArray(visibleRecommendations, 2);

  const totalVisibleCerts = visibleCertCategories.reduce((acc, c) => acc + c.certs.length, 0);
  const totalVisibleAwards = visibleAwardsGroups.reduce((acc, g) => acc + g.awards.length, 0);

  const getPdfFilename = () => {
    switch (preset) {
      case 'summary':
        return 'Mohammed_Sufyan_Executive_Summary.pdf';
      case 'concise':
        return 'Mohammed_Sufyan_Concise_CV.pdf';
      case 'full':
        return 'Mohammed_Sufyan_Full_Portfolio.pdf';
      case 'security':
        return 'Mohammed_Sufyan_Security_Track.pdf';
      case 'platform':
        return 'Mohammed_Sufyan_Platform_Track.pdf';
      case 'fullstack':
        return 'Mohammed_Sufyan_Fullstack_Track.pdf';
      default:
        return 'Mohammed_Sufyan_Custom_CV.pdf';
    }
  };

  const handleDownloadPdf = async () => {
    if (!contentRef.current || isGeneratingPdf || selectedSectionCount === 0) return;

    setIsGeneratingPdf(true);
    setPdfError(null);
    setPdfSuccess(false);

    let cloneHost: HTMLDivElement | null = null;

    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const CAPTURE_WIDTH = 1024;
      const canvasBgHex = isLight ? '#ffffff' : '#06080d';
      const canvasTextHex = isLight ? '#0f172a' : '#e2e8f0';

      cloneHost = document.createElement('div');
      cloneHost.id = 'pdf-clone-host';
      cloneHost.className = 'pdf-capture';
      cloneHost.style.position = 'absolute';
      cloneHost.style.left = '0';
      cloneHost.style.top = '0';
      cloneHost.style.width = `${CAPTURE_WIDTH}px`;
      cloneHost.style.backgroundColor = canvasBgHex;
      cloneHost.style.color = canvasTextHex;
      cloneHost.style.opacity = '0';
      cloneHost.style.zIndex = '-9999';
      cloneHost.style.pointerEvents = 'none';

      const clonedContent = contentRef.current.cloneNode(true) as HTMLDivElement;
      clonedContent.style.width = `${CAPTURE_WIDTH}px`;
      clonedContent.style.maxHeight = 'none';
      clonedContent.style.overflow = 'visible';
      clonedContent.style.backgroundColor = canvasBgHex;

      cloneHost.appendChild(clonedContent);
      document.body.appendChild(cloneHost);

      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const imgs = Array.from(clonedContent.querySelectorAll<HTMLImageElement>('img'));
      await Promise.all(
        imgs.map((img) => (typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve()))
      );

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 8;
      const marginY = 9;
      const footerReserveMm = 7;
      const contentWidthMm = pageWidth - marginX * 2;
      const maxPageY = pageHeight - marginY - footerReserveMm;
      const maxContentHeightMm = maxPageY - marginY;
      const blockGapMm = 2.5;

      const paintPdfPage = () => {
        if (isLight) {
          pdf.setFillColor(255, 255, 255);
        } else {
          pdf.setFillColor(6, 8, 13);
        }
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      };

      paintPdfPage();
      let currentY = marginY;

      const sections = Array.from(clonedContent.querySelectorAll<HTMLElement>('[data-pdf-section]'));
      const sliceCanvas = document.createElement('canvas');
      const sliceCtx = sliceCanvas.getContext('2d');

      const drawSlice = (
        sectionCanvas: HTMLCanvasElement,
        canvasScale: number,
        pxToMm: number,
        topPx: number,
        heightPx: number,
        links: Array<{ href: string; leftPx: number; topPx: number; widthPx: number; heightPx: number }>
      ) => {
        if (!sliceCtx || heightPx <= 1) return 0;

        const bleedTopPx = Math.max(0, Math.floor(topPx * canvasScale) - 1);
        const rawEndPx = Math.ceil((topPx + heightPx) * canvasScale) + 1;
        const srcY = bleedTopPx;
        const srcH = Math.min(sectionCanvas.height - srcY, Math.max(1, rawEndPx - srcY));
        if (srcH <= 0) return 0;

        sliceCanvas.width = sectionCanvas.width;
        sliceCanvas.height = srcH;
        sliceCtx.fillStyle = canvasBgHex;
        sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        sliceCtx.drawImage(
          sectionCanvas,
          0,
          srcY,
          sectionCanvas.width,
          srcH,
          0,
          0,
          sectionCanvas.width,
          srcH
        );

        const imgData = sliceCanvas.toDataURL('image/png');
        const drawHeightMm = (srcH / canvasScale) * pxToMm;

        pdf.addImage(imgData, 'PNG', marginX, currentY, contentWidthMm, drawHeightMm, undefined, 'FAST');

        for (const link of links) {
          if (!link.href || link.widthPx <= 0 || link.heightPx <= 0) continue;
          const linkRelTopPx = link.topPx;
          if (linkRelTopPx + link.heightPx < 0 || linkRelTopPx > heightPx) continue;
          pdf.link(
            marginX + link.leftPx * pxToMm,
            currentY + linkRelTopPx * pxToMm,
            link.widthPx * pxToMm,
            link.heightPx * pxToMm,
            { url: link.href }
          );
        }

        return drawHeightMm;
      };

      for (const section of sections) {
        const sectionRect = section.getBoundingClientRect();
        if (sectionRect.height <= 0 || sectionRect.width <= 0) continue;

        const blocks = Array.from(section.querySelectorAll<HTMLElement>('[data-pdf-block]')).map((el) => {
          const rect = el.getBoundingClientRect();
          const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href]')).map((a) => {
            const aRect = a.getBoundingClientRect();
            return {
              href: a.href,
              leftPx: aRect.left - rect.left,
              topPx: aRect.top - rect.top,
              widthPx: aRect.width,
              heightPx: aRect.height
            };
          });

          const subblocks = Array.from(el.querySelectorAll<HTMLElement>('[data-pdf-subblock]')).map((sub) => {
            const sRect = sub.getBoundingClientRect();
            return {
              relTopPx: sRect.top - rect.top,
              heightPx: sRect.height
            };
          });

          return {
            topPx: rect.top - sectionRect.top,
            heightPx: rect.height,
            widthPx: rect.width,
            keepWithNext: el.hasAttribute('data-pdf-keep-next'),
            links,
            subblocks
          };
        });

        const sectionCanvas = await html2canvas(section, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: canvasBgHex,
          logging: false,
          width: CAPTURE_WIDTH,
          windowWidth: CAPTURE_WIDTH,
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc) => {
            clonedDoc.documentElement.scrollTop = 0;
            clonedDoc.body.scrollTop = 0;
            const host = clonedDoc.getElementById('pdf-clone-host');
            if (host) {
              host.style.opacity = '1';
              host.style.zIndex = '1';
            }
          }
        });

        const canvasScale = sectionCanvas.width / sectionRect.width;
        const pxToMm = contentWidthMm / sectionRect.width;

        const targetBlocks =
          blocks.length > 0
            ? blocks
            : [
                {
                  topPx: 0,
                  heightPx: sectionRect.height,
                  widthPx: sectionRect.width,
                  keepWithNext: false,
                  links: [],
                  subblocks: []
                }
              ];

        for (let i = 0; i < targetBlocks.length; i++) {
          const block = targetBlocks[i];
          if (block.heightPx <= 1) continue;

          const blockHeightMm = block.heightPx * pxToMm;

          // Prevent heading/banner orphaning by checking space for this header + next content block
          let requiredHeightMm = blockHeightMm;
          if (block.keepWithNext && i + 1 < targetBlocks.length) {
            let lookIdx = i + 1;
            let chainMm = blockHeightMm;
            while (lookIdx < targetBlocks.length) {
              const nextB = targetBlocks[lookIdx];
              const nextMm = nextB.heightPx * pxToMm;
              chainMm += blockGapMm + (nextB.keepWithNext ? nextMm : Math.min(nextMm, 52));
              if (!nextB.keepWithNext) break;
              lookIdx++;
            }
            if (chainMm <= maxContentHeightMm) {
              requiredHeightMm = chainMm;
            }
          }

          if (currentY + requiredHeightMm > maxPageY && currentY > marginY + 1) {
            pdf.addPage();
            paintPdfPage();
            currentY = marginY;
          }

          // Safeguard: if a single block still exceeds one full page, split along sub-block boundaries
          if (blockHeightMm > maxContentHeightMm) {
            const chunks: Array<{ startPx: number; endPx: number }> = [];
            if (block.subblocks.length > 0) {
              let chunkStart = 0;
              let chunkEnd = 0;
              for (const sub of block.subblocks) {
                const subEnd = Math.min(block.heightPx, sub.relTopPx + sub.heightPx);
                if ((subEnd - chunkStart) * pxToMm > maxContentHeightMm && chunkEnd > chunkStart) {
                  chunks.push({ startPx: chunkStart, endPx: chunkEnd });
                  chunkStart = sub.relTopPx;
                }
                chunkEnd = subEnd;
              }
              if (chunkEnd > chunkStart) {
                chunks.push({ startPx: chunkStart, endPx: block.heightPx });
              }
            } else {
              const stepPx = maxContentHeightMm / pxToMm;
              for (let pos = 0; pos < block.heightPx; pos += stepPx) {
                chunks.push({ startPx: pos, endPx: Math.min(block.heightPx, pos + stepPx) });
              }
            }

            for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
              const ch = chunks[cIdx];
              const chMm = (ch.endPx - ch.startPx) * pxToMm;
              if (currentY + chMm > maxPageY && currentY > marginY + 1) {
                pdf.addPage();
                paintPdfPage();
                currentY = marginY;
              }
              const shiftedLinks = block.links.map((l) => ({
                ...l,
                topPx: l.topPx - ch.startPx
              }));
              const drawn = drawSlice(
                sectionCanvas,
                canvasScale,
                pxToMm,
                block.topPx + ch.startPx,
                ch.endPx - ch.startPx,
                shiftedLinks
              );
              currentY += drawn + (cIdx === chunks.length - 1 ? blockGapMm : 1.5);
            }
          } else {
            const drawn = drawSlice(
              sectionCanvas,
              canvasScale,
              pxToMm,
              block.topPx,
              block.heightPx,
              block.links
            );
            currentY += drawn + blockGapMm;
          }
        }
      }

      // Stamp clean subtle executive footer & page count on every page
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        if (isLight) {
          pdf.setDrawColor(203, 213, 225);
          pdf.setTextColor(71, 85, 105);
        } else {
          pdf.setDrawColor(30, 41, 59);
          pdf.setTextColor(100, 116, 139);
        }
        pdf.setLineWidth(0.2);
        pdf.line(marginX, pageHeight - 10, pageWidth - marginX, pageHeight - 10);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.text('Mohammed Sufyan · Software Engineer', marginX, pageHeight - 5.5);
        pdf.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, pageHeight - 5.5, { align: 'right' });
      }

      pdf.save(getPdfFilename());
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3500);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setPdfError('Could not generate PDF automatically. Try opening in a new tab or using Browser Print.');
    } finally {
      if (cloneHost && cloneHost.parentNode) {
        cloneHost.parentNode.removeChild(cloneHost);
      }
      setIsGeneratingPdf(false);
    }
  };

  const handleNativePrint = () => {
    window.print();
  };

  const handleCopyAtsText = async () => {
    if (selectedSectionCount === 0) return;
    const atsText = buildAtsPlainTextResume({
      sections: config.sections,
      skillsDepth: config.skillsDepth,
      experienceDepth: config.experienceDepth,
      visibleExperience,
      visibleCertCategories,
      visibleAwardsGroups,
      visibleRecommendations,
    });
    try {
      await navigator.clipboard.writeText(atsText);
      setAtsCopied(true);
      setPdfError(null);
      window.setTimeout(() => setAtsCopied(false), 2600);
    } catch {
      setPdfError('Clipboard access was blocked by the browser. Try Browser Print or PDF download.');
    }
  };

  const getFormatLabel = () => {
    switch (preset) {
      case 'summary':
        return 'Executive Summary';
      case 'concise':
        return 'Concise CV';
      case 'full':
        return 'Entire Portfolio';
      case 'security':
        return 'Security Track';
      case 'platform':
        return 'Platform Track';
      case 'fullstack':
        return 'Full-stack Track';
      default:
        return 'Custom Selection';
    }
  };

  const handleRequestPdf = () => {
    if (isGeneratingPdf || selectedSectionCount === 0) return;
    if (cvUnlocked || isAccessUnlocked('pdf')) {
      setCvUnlocked(true);
      void handleDownloadPdf();
      return;
    }
    setPendingAction('pdf');
  };

  const handleRequestPrint = () => {
    if (selectedSectionCount === 0) return;
    if (cvUnlocked || isAccessUnlocked('print')) {
      setCvUnlocked(true);
      handleNativePrint();
      return;
    }
    setPendingAction('print');
  };

  const handleRequestAtsCopy = () => {
    if (selectedSectionCount === 0) return;
    if (cvUnlocked || isAccessUnlocked('ats')) {
      setCvUnlocked(true);
      void handleCopyAtsText();
      return;
    }
    setPendingAction('ats');
  };

  const handleAccessVerified = (action: AccessGateAction) => {
    setCvUnlocked(true);
    setPendingAction(null);
    if (action === 'pdf') {
      void handleDownloadPdf();
    } else if (action === 'ats') {
      void handleCopyAtsText();
    } else if (action === 'print') {
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.print();
        }, 80);
      });
    }
  };

  const skillRows = chunkArray(TECHNICAL_DISCIPLINES, 2);

  // Explicit theme palette for Dark (screen-matched) vs Light Paper (ink-friendly) export & print
  const t = {
    doc: isLight
      ? 'bg-white text-slate-900 print:bg-white'
      : 'bg-[#06080d] text-slate-200 print:bg-[#06080d]',
    secA: isLight
      ? 'border-b border-slate-200 bg-white'
      : 'border-b border-slate-800/80 bg-[#07090e]',
    secB: isLight
      ? 'border-b border-slate-200 bg-slate-50/70'
      : 'border-b border-slate-800/80 bg-[#06080d]',
    secFooter: isLight
      ? 'border-t border-slate-200 bg-slate-100'
      : 'bg-[#05070b]',
    card: isLight
      ? 'border-slate-200 bg-white shadow-xs'
      : 'border-slate-800 bg-[#0d121f]/80',
    cardSubtle: isLight
      ? 'border-slate-200 bg-white shadow-xs'
      : 'border-slate-800 bg-[#0d121f]/75',
    banner: isLight
      ? 'border-slate-200 bg-slate-100/90'
      : 'border-slate-800 bg-[#0a0e1a]',
    verifyBox: isLight
      ? 'border-slate-200 bg-slate-50'
      : 'border-slate-800 bg-[#0a0f1c]/90',
    chip: isLight
      ? 'bg-slate-100 border-slate-200 text-slate-700'
      : 'bg-[#090d16] border-slate-800 text-slate-300',
    chipMuted: isLight
      ? 'bg-slate-100 border-slate-200 text-slate-600'
      : 'bg-[#090d16] border-slate-800 text-slate-400',
    chipPillar: isLight
      ? 'bg-sky-50 border-sky-200 text-sky-800'
      : 'bg-[#090d16] border-slate-700/80 text-cyan-300/90',
    iconBox: isLight
      ? 'bg-white border-slate-200 text-sky-700'
      : 'bg-slate-900 border-slate-700/80 text-cyan-400',
    iconBoxDark: isLight
      ? 'bg-slate-100 border-slate-200'
      : 'bg-[#090d16] border-slate-800',
    heading: isLight ? 'text-slate-900' : 'text-white',
    subheading: isLight ? 'text-slate-800' : 'text-slate-200',
    body: isLight ? 'text-slate-700' : 'text-slate-300',
    muted: isLight ? 'text-slate-600' : 'text-slate-400',
    subtle: isLight ? 'text-slate-500' : 'text-slate-500',
    accent: isLight ? 'text-sky-700' : 'text-cyan-400',
    accentSoft: isLight ? 'text-sky-700' : 'text-cyan-400/90',
    accentLink: isLight ? 'text-sky-700' : 'text-cyan-300',
    accentHero: isLight ? 'text-sky-700' : 'text-[#38bdf8]',
    accentBadge: isLight
      ? 'bg-sky-50 border-sky-200 text-sky-800'
      : 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300',
    accentBadgeStrong: isLight
      ? 'bg-sky-100 border-sky-300 text-sky-900'
      : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300',
    periodPill: isLight
      ? 'bg-slate-100 border-slate-200 text-slate-700'
      : 'bg-slate-900 border-slate-800 text-slate-300',
    bulletDot: isLight ? 'bg-sky-600' : 'bg-cyan-400',
    divider: isLight ? 'border-slate-200' : 'border-slate-800/80',
    blockquote: isLight ? 'text-slate-800 border-sky-600' : 'text-slate-100 border-cyan-400/80',
    emeraldText: isLight ? 'text-emerald-700' : 'text-emerald-400',
    emeraldBadge: isLight
      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
      : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300',
    starBadge: isLight
      ? 'bg-amber-50 border-amber-200 text-amber-600'
      : 'bg-amber-400/10 border-amber-400/20 text-amber-400',
    medalColor: isLight ? 'text-amber-600' : 'text-amber-400',
    progressTrack: isLight ? 'bg-slate-200 border-slate-300' : 'bg-slate-900 border-slate-800',
    progressBar: isLight ? 'bg-gradient-to-r from-sky-600 to-cyan-600' : 'bg-gradient-to-r from-cyan-500 to-sky-400',
    portraitFrame: isLight
      ? 'border-sky-200 bg-slate-100'
      : 'border-cyan-500/35 bg-[radial-gradient(circle_at_50%_32%,#14233b_0%,#0a101e_58%,#06080d_100%)]'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Export CV or Portfolio PDF"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`fixed inset-0 z-50 flex justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto print:static print:inset-auto print:block print:p-0 print:overflow-visible print-no-blur print-reset-motion ${
            isLight ? 'print:bg-white' : 'print:bg-[#06080d]'
          }`}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
            className={`relative w-full max-w-6xl max-h-[95vh] sm:max-h-[92vh] flex flex-col print:block rounded-2xl border border-slate-700 bg-[#07090e] shadow-2xl overflow-hidden my-auto print:max-w-none print:max-h-none print:rounded-none print:border-0 print:shadow-none print:overflow-visible print-reset-motion ${
              isLight ? 'print:bg-white' : 'print:bg-[#06080d]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
        {/* Top Modal Action Bar & Format Selector (hidden when printing) */}
        <div className="relative border-b border-slate-800 bg-[#080b13] shrink-0 print:hidden">
          <ModalHeaderScan active={isOpen} />
          <div className="flex flex-col gap-3 px-4 sm:px-6 py-3 sm:py-3.5">
            {/* Title row — always full width so it never collides with actions */}
            <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.06 }}
                  transition={{ rotate: { duration: 0.65, ease: EASE_OUT_EXPO }, scale: { type: 'spring', stiffness: 400, damping: 20 } }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/30 text-cyan-400 font-bold font-display text-xs"
                >
                  MS
                </motion.div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-white text-sm sm:text-base">
                      Export CV / Portfolio PDF
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded uppercase whitespace-nowrap">
                      {getFormatLabel()}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5 leading-snug">
                    Choose a layout preset or customize sections below before downloading
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Actions on their own row — wrap cleanly at any width */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCvTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer overflow-hidden ${
                  isLight
                    ? 'border-amber-400/60 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                    : 'border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white'
                }`}
                title={isLight ? 'Switch CV preview & export to Dark Theme' : 'Switch CV preview & export to Light Paper (ink-friendly)'}
              >
                <span className="relative h-3.5 w-3.5">
                  <AnimatePresence mode="wait" initial={false}>
                    {isLight ? (
                      <motion.span
                        key="cv-sun"
                        initial={{ opacity: 0, rotate: -50, scale: 0.5 }}
                        animate={{ opacity: 1, rotate: 0, scale: 1 }}
                        exit={{ opacity: 0, rotate: 50, scale: 0.5 }}
                        transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <Sun className="w-3.5 h-3.5 text-amber-300" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="cv-moon"
                        initial={{ opacity: 0, rotate: 50, scale: 0.5 }}
                        animate={{ opacity: 1, rotate: 0, scale: 1 }}
                        exit={{ opacity: 0, rotate: -50, scale: 0.5 }}
                        transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <Moon className="w-3.5 h-3.5 text-cyan-400" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span>{isLight ? 'Light Paper' : 'Dark Theme'}</span>
              </button>

              <button
                onClick={() => setShowCustomize((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  showCustomize
                    ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-300'
                    : 'border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Customize</span>
              </button>

              <ShineSurface className="rounded-lg" shineClassName="via-white/45">
                <button
                  onClick={handleRequestPdf}
                  disabled={isGeneratingPdf || selectedSectionCount === 0}
                  className="relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#38bdf8] hover:bg-sky-300 disabled:opacity-60 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-sky-500/20 cursor-pointer overflow-hidden"
                >
                  {isGeneratingPdf ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating PDF...</span>
                    </>
                  ) : pdfSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>PDF Downloaded!</span>
                      <motion.span
                        aria-hidden="true"
                        initial={{ scale: 0.4, opacity: 0.7 }}
                        animate={{ scale: 2.4, opacity: 0 }}
                        transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
                        className="pointer-events-none absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/70"
                      />
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Print / PDF</span>
                    </>
                  )}
                </button>
              </ShineSurface>

              <button
                onClick={handleRequestPrint}
                disabled={selectedSectionCount === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 disabled:opacity-60 text-slate-300 hover:text-white font-medium text-xs transition-colors cursor-pointer"
                title="Open native browser print dialog"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Browser Print</span>
              </button>

              <button
                type="button"
                onClick={handleRequestAtsCopy}
                disabled={selectedSectionCount === 0}
                className={`relative overflow-hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium text-xs transition-colors cursor-pointer disabled:opacity-60 ${
                  atsCopied
                    ? 'border-emerald-500/60 bg-emerald-950/50 text-emerald-300'
                    : 'border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white'
                }`}
                title="Copy ATS-friendly plain-text CV matching current preset"
              >
                {atsCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ATS Copied!</span>
                    <motion.span
                      aria-hidden="true"
                      initial={{ scale: 0.35, opacity: 0.65 }}
                      animate={{ scale: 2.2, opacity: 0 }}
                      transition={{ duration: 0.85, ease: EASE_OUT_EXPO }}
                      className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-emerald-400/60"
                    />
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Copy ATS Text</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {pdfError && (
            <div className="mx-4 sm:mx-6 mb-3 px-3 py-2 rounded-lg text-[11px] font-mono text-rose-300 bg-rose-950/50 border border-rose-500/30">
              {pdfError}
            </div>
          )}

          {/* Preset Mode Switcher Strip */}
          <div className="px-4 sm:px-6 pb-3 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#0d121f] border border-slate-800 w-full">
              {(
                [
                  { id: 'summary' as const, short: 'Summary', long: 'Executive Summary' },
                  { id: 'concise' as const, short: 'Concise', long: 'Concise CV' },
                  { id: 'full' as const, short: 'Full', long: 'Full Portfolio' },
                  { id: 'security' as const, short: 'Security', long: 'Security Track' },
                  { id: 'platform' as const, short: 'Platform', long: 'Platform Track' },
                  { id: 'fullstack' as const, short: 'Full-stack', long: 'Full-stack Track' },
                ]
              ).map((item) => {
                const active = preset === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => applyPreset(item.id)}
                    className={`relative px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                      active ? 'text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="cv-preset-pill"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        className="absolute inset-0 rounded-lg bg-cyan-500 shadow-sm"
                      />
                    )}
                    <span className="relative z-10">
                      <span className="sm:hidden">{item.short}</span>
                      <span className="hidden sm:inline">{item.long}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="text-[11px] font-mono text-slate-400 leading-snug">
              {preset === 'summary' && 'Stats + Recent Roles + Compact Skills + Top 6 Certs + Education'}
              {preset === 'concise' && `All Roles (Top 3 Highlights) + Full Skills + Top 8 Certs + Key Honors + ${visibleRecommendations.length} Endorsements`}
              {preset === 'full' && `Complete Archive: All ${totalRoleCount} Roles + All ${CERTIFICATIONS.length} Certs + All ${AWARDS.length} Honors + ${LINKEDIN_RECOMMENDATIONS.length} Recommendations`}
              {preset === 'security' && 'Security-leaning CV: philosophy + concise roles + full skills + top certs + featured honors'}
              {preset === 'platform' && 'Platform-leaning CV: full roles + full skills + top certs + featured honors'}
              {preset === 'fullstack' && 'Delivery-leaning CV: concise roles + full skills + top 6 certs + education'}
              {preset === 'custom' && `${selectedSectionCount} section${selectedSectionCount === 1 ? '' : 's'} selected for export`}
            </div>
          </div>

          {/* Expandable Section & Granularity Checklist */}
          <AnimatePresence initial={false}>
            {showCustomize && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                className="overflow-hidden border-t border-slate-800/80 bg-[#0a0e18]"
              >
                <div className="px-5 sm:px-6 py-3.5 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mr-1">
                  Include Sections:
                </span>
                {(
                  [
                    ['overview', 'Overview & Stats'],
                    ['philosophy', 'Philosophy'],
                    ['experience', 'Experience'],
                    ['skills', 'Technical Skills'],
                    ['certifications', 'Certifications'],
                    ['awards', 'Honors & Awards'],
                    ['education', 'Education']
                  ] as const
                ).map(([key, label]) => {
                  const checked = config.sections[key];
                  return (
                    <button
                      key={key}
                      onClick={() => toggleSection(key)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                        checked
                          ? 'bg-cyan-950/50 border-cyan-500/50 text-cyan-200'
                          : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <span
                        className={`w-3 h-3 rounded-sm flex items-center justify-center border ${
                          checked ? 'bg-cyan-400 border-cyan-400 text-slate-950' : 'border-slate-600'
                        }`}
                      >
                        {checked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-400">
                {config.sections.experience && (
                  <div className="flex items-center gap-1.5">
                    <span>Experience Depth:</span>
                    {(['compact', 'concise', 'full'] as const).map((depth) => (
                      <button
                        key={depth}
                        onClick={() => {
                          setPreset('custom');
                          setConfig((prev) => ({ ...prev, experienceDepth: depth }));
                        }}
                        className={`px-2 py-0.5 rounded border capitalize cursor-pointer ${
                          config.experienceDepth === depth
                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                            : 'border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {depth}
                      </button>
                    ))}
                  </div>
                )}

                {config.sections.certifications && (
                  <div className="flex items-center gap-1.5">
                    <span>Certs:</span>
                    {(['top6', 'top8', 'full'] as const).map((depth) => (
                      <button
                        key={depth}
                        onClick={() => {
                          setPreset('custom');
                          setConfig((prev) => ({ ...prev, certsDepth: depth }));
                        }}
                        className={`px-2 py-0.5 rounded border cursor-pointer ${
                          config.certsDepth === depth
                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                            : 'border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {depth === 'top6' ? 'Top 6' : depth === 'top8' ? 'Top 8' : `All ${CERTIFICATIONS.length}`}
                      </button>
                    ))}
                  </div>
                )}

                {config.sections.awards && (
                  <div className="flex items-center gap-1.5">
                    <span>Awards:</span>
                    {(['featured', 'full'] as const).map((depth) => (
                      <button
                        key={depth}
                        onClick={() => {
                          setPreset('custom');
                          setConfig((prev) => ({ ...prev, awardsDepth: depth }));
                        }}
                        className={`px-2 py-0.5 rounded border cursor-pointer ${
                          config.awardsDepth === depth
                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                            : 'border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {depth === 'featured'
                          ? 'Key Honors (8) & 7 Quotes'
                          : `All ${AWARDS.length} & ${LINKEDIN_RECOMMENDATIONS.length} Quotes`}
                      </button>
                    ))}
                  </div>
                )}
                </div>
              </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Scrollable & Printable Portfolio Content */}
        <div
          ref={contentRef}
          className={`pdf-doc overflow-y-auto print:overflow-visible print:max-h-none ${t.doc}`}
        >
          {selectedSectionCount === 0 && (
            <div className={`p-12 text-center text-sm font-mono ${t.muted}`}>
              Select at least one section from Customize or choose a preset above to preview and export your PDF.
            </div>
          )}

          {/* SECTION 1: HERO & OVERVIEW */}
          {config.sections.overview && (
            <section
              data-pdf-section
              className={`pdf-section px-6 py-8 sm:px-10 sm:py-10 ${t.secA}`}
            >
              <div className="space-y-6">
                <div data-pdf-block className="pdf-keep-together space-y-5">
                  <div className="flex flex-col sm:flex-row pdf-row-sm sm:items-center justify-between gap-5">
                    <div className="flex flex-col space-y-3 min-w-0">
                      <h1 className={`pdf-title-lg text-3xl sm:text-5xl font-display font-extrabold tracking-tight leading-[1.08] ${t.heading}`}>
                        Hello! I&apos;m <span className={t.accentHero}>Mohammed Sufyan</span>
                      </h1>

                      <h2 className={`text-sm sm:text-base font-medium leading-snug ${t.subheading}`}>
                        <span className="sm:hidden print:hidden">Software Engineer — Cisco STO CTO Ops</span>
                        <span className="hidden sm:inline print:inline">Software Engineer — Cisco Systems Inc. Security &amp; Trust Organization (STO) CTO Operations</span>
                      </h2>
                    </div>

                    <div className="shrink-0 self-start sm:self-center">
                      <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border shadow-lg ${t.portraitFrame}`}>
                        <img
                          src="/assets/aistudio/Sufyan_hero_portrait.png"
                          alt="Mohammed Sufyan"
                          className="w-full h-full object-contain object-bottom"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-3.5">
                    <p className={`text-xs sm:text-sm leading-relaxed max-w-4xl font-light ${t.muted}`}>
                      Architecting high-velocity security data platforms, multi-cloud vulnerability engines, and enterprise compliance systems across 13+ years of engineering experience with{' '}
                      <span className="sm:hidden print:hidden">Cisco</span>
                      <span className="hidden sm:inline print:inline">Cisco Systems Inc.</span>
                      , HCL America Inc./HCLTech, and Tata Consultancy Services in the United States, United Kingdom, and India.
                    </p>

                    <div className={`pt-1 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-mono ${t.body}`}>
                      <span className="flex items-center gap-1.5">
                        <MapPin className={`w-3.5 h-3.5 shrink-0 ${t.accent}`} />
                        {PERSONAL_INFO.location}
                      </span>
                      <a
                        href={`mailto:${PERSONAL_INFO.email}`}
                        className={`flex items-center gap-1.5 ${isLight ? 'hover:text-sky-700' : 'hover:text-cyan-300'}`}
                      >
                        <Mail className={`w-3.5 h-3.5 shrink-0 ${t.accent}`} />
                        {PERSONAL_INFO.email}
                      </a>
                      <a
                        href={PERSONAL_INFO.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-1.5 hover:underline ${t.accentLink}`}
                      >
                        <Globe className={`w-3.5 h-3.5 shrink-0 ${t.accent}`} />
                        linkedin.com/in/mohammed-sufyan
                      </a>
                    </div>
                  </div>
                </div>

                {/* 4-Column Statistics Strip */}
                <div
                  data-pdf-block
                  className="pdf-keep-together grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 pdf-cols-4 gap-3.5"
                >
                  {STATS.map((stat, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl border p-4 ${t.card}`}
                    >
                      <div className={`flex items-baseline gap-1 font-display font-extrabold text-2xl sm:text-3xl tabular-nums tracking-tight ${t.heading}`}>
                        <span>{stat.value}</span>
                        {stat.fraction && (
                          <span className={`text-base font-normal ${t.muted}`}>{stat.fraction}</span>
                        )}
                      </div>
                      <div className={`mt-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider font-mono ${t.accent}`}>
                        {stat.label}
                      </div>
                      <div className={`mt-1 text-[11px] ${t.muted}`}>
                        {stat.sublabel.includes('Cisco Systems Inc.') ? (
                          <>
                            <span className="sm:hidden print:hidden">{stat.sublabel.replace('Cisco Systems Inc.', 'Cisco')}</span>
                            <span className="hidden sm:inline print:inline">{stat.sublabel}</span>
                          </>
                        ) : (
                          stat.sublabel
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* SECTION 2: PHILOSOPHY & PERSONAL PROFILE */}
          {config.sections.philosophy && (
            <section
              data-pdf-section
              className={`pdf-section px-6 py-8 sm:px-10 sm:py-10 ${t.secB}`}
            >
              <div className="space-y-5">
                <div data-pdf-block data-pdf-keep-next className="pdf-keep-next">
                  <div className={`inline-flex items-center gap-1.5 text-xs font-mono font-medium tracking-wider uppercase mb-1.5 ${t.accent}`}>
                    <Compass className="w-3.5 h-3.5" />
                    <span>ARCHITECTURAL PROFILE</span>
                  </div>
                  <h2 className={`pdf-h2 text-2xl sm:text-3xl font-display font-bold tracking-tight ${t.heading}`}>
                    Personal Profile &amp; Engineering Philosophy
                  </h2>
                </div>

                <div data-pdf-block className={`pdf-keep-together rounded-2xl border p-6 flex flex-col justify-between ${t.card}`}>
                  <div className="space-y-4">
                    <blockquote className={`text-sm sm:text-base font-medium leading-relaxed italic border-l-2 pl-4 ${t.blockquote}`}>
                      &ldquo;{PERSONAL_INFO.philosophy.quote1}&rdquo;
                    </blockquote>

                    <p className={`text-xs sm:text-sm leading-relaxed font-light ${t.body}`}>
                      {PERSONAL_INFO.philosophy.body}
                    </p>

                    <p className={`text-xs leading-relaxed ${t.muted}`}>
                      Over the course of 13+ years of production system engineering across Fortune 500 organizations, my leadership focus has centered on architecting self-healing, auditable multi-cloud foundations. By bridging developer velocity with rigorous Zero Trust boundaries and telemetry instrumentation, distributed pods achieve deterministic reliability and peak operational velocity.
                    </p>
                  </div>

                  <div className={`pt-5 mt-5 border-t ${t.divider}`}>
                    <div className={`text-[10px] font-mono uppercase tracking-wider mb-2.5 ${t.muted}`}>
                      Core Architectural Pillars &amp; Disciplines
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {pillars.map((pillar, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-mono tracking-wide border ${t.chipPillar}`}
                        >
                          {pillar}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SECTION 3: PROFESSIONAL EXPERIENCE */}
          {config.sections.experience && (
            <section
              data-pdf-section
              className={`pdf-section px-6 py-8 sm:px-10 sm:py-10 ${t.secA}`}
            >
              <div data-pdf-block data-pdf-keep-next className="pdf-keep-next mb-6">
                <div className={`inline-flex items-center gap-1.5 text-xs font-mono font-medium tracking-wider uppercase mb-1.5 ${t.accent}`}>
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>PROFESSIONAL TIMELINE</span>
                </div>
                <h2 className={`pdf-h2 text-2xl sm:text-3xl font-display font-bold tracking-tight ${t.heading}`}>
                  Professional Experience &amp; Leadership
                </h2>
                <p className={`mt-1.5 text-xs sm:text-sm max-w-4xl ${t.muted}`}>
                  Comprehensive timeline spanning enterprise systems engineering, cloud architecture, SRE, and consulting engagements across{' '}
                  <span className="sm:hidden print:hidden">Cisco</span>
                  <span className="hidden sm:inline print:inline">Cisco Systems Inc.</span>
                  , HCL America Inc./HCLTech, and Tata Consultancy Services — spanning the US, UK, and India.
                </p>
              </div>

              <div className="space-y-6">
                {visibleExperience.map((comp) => (
                  <div key={comp.company} className="space-y-3">
                    {/* Standalone Company Header Banner */}
                    <div
                      data-pdf-block
                      data-pdf-keep-next
                      className={`pdf-keep-next pdf-keep-together flex flex-col sm:flex-row pdf-row-sm sm:items-center justify-between p-4 sm:p-5 rounded-xl border gap-2 ${t.banner}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border shrink-0 ${t.iconBox}`}>
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`text-base sm:text-lg font-display font-bold ${t.heading}`}>
                              {comp.company.includes('Cisco') ? (
                                <>
                                  <span className="sm:hidden print:hidden">Cisco</span>
                                  <span className="hidden sm:inline print:inline">Cisco Systems Inc.</span>
                                </>
                              ) : (
                                comp.company
                              )}
                            </h3>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wider border ${t.accentBadgeStrong}`}>
                              {comp.companyTag}
                            </span>
                          </div>
                          <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono mt-0.5 ${t.muted}`}>
                            <span className="flex items-center gap-1">
                              <MapPin className={`w-3 h-3 ${t.subtle}`} />
                              {comp.location}
                            </span>
                            <span>·</span>
                            <span className={`flex items-center gap-1 ${t.body}`}>
                              <Calendar className={`w-3 h-3 ${t.accent}`} />
                              {comp.tenure}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Self-Contained Role Cards (complete closed borders across page breaks) */}
                    {comp.roles.map((role, rIdx) => (
                      <div
                        key={rIdx}
                        data-pdf-block
                        className={`pdf-keep-together rounded-xl border p-4 sm:p-5 ${t.card}`}
                      >
                        <div data-pdf-subblock className="mb-2.5 space-y-1.5">
                          <div className="flex flex-col gap-2 sm:flex-row pdf-row-sm sm:items-start sm:justify-between">
                            <h4 className={`min-w-0 text-sm sm:text-base font-display font-semibold text-balance ${t.heading}`}>
                              {role.role}
                            </h4>
                            <div className={`flex flex-wrap items-center gap-2 font-mono text-[11px] sm:justify-end sm:max-w-[min(100%,22rem)] ${t.muted}`}>
                              <span className={`px-2 py-0.5 rounded border whitespace-nowrap ${t.periodPill}`}>
                                {role.period}
                              </span>
                              <span className={t.subtle}>|</span>
                              <span className="min-w-0 leading-snug">{role.location}</span>
                            </div>
                          </div>
                          {role.domain && (
                            <div className={`text-xs font-mono leading-relaxed ${t.accentSoft}`}>
                              {role.domain}
                            </div>
                          )}
                        </div>

                        <ul className={`space-y-1.5 text-xs pl-1 my-3 ${t.body}`}>
                          {role.highlights.map((bullet, bIdx) => (
                            <li
                              key={bIdx}
                              data-pdf-subblock
                              className="flex items-start gap-2 leading-relaxed"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${t.bulletDot}`}></span>
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>

                        {role.recognitionBadge && (
                          <div
                            data-pdf-subblock
                            className={`my-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono ${t.accentBadge}`}
                          >
                            <Award className={`w-3.5 h-3.5 shrink-0 ${t.accent}`} />
                            <span>Honor: {role.recognitionBadge}</span>
                          </div>
                        )}

                        {role.technologies.length > 0 && config.experienceDepth !== 'compact' && (
                          <div
                            data-pdf-subblock
                            className="pt-2 flex flex-wrap items-center gap-1.5"
                          >
                            <span className={`text-[10px] font-mono uppercase tracking-wider mr-1 ${t.muted}`}>
                              Stack:
                            </span>
                            {role.technologies.map((tech, tIdx) => (
                              <span
                                key={tIdx}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono border ${t.chip}`}
                              >
                                {tech}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* SECTION 4: TECHNICAL SKILLS & DISCIPLINES */}
          {config.sections.skills && (
            <section
              data-pdf-section
              className={`pdf-section px-6 py-8 sm:px-10 sm:py-10 ${t.secB}`}
            >
              <div className="space-y-5">
                <div data-pdf-block data-pdf-keep-next className="pdf-keep-next">
                  <div className={`inline-flex items-center gap-1.5 text-xs font-mono font-medium tracking-wider uppercase mb-1.5 ${t.accent}`}>
                    <Cpu className="w-3.5 h-3.5" />
                    <span>DISCIPLINE TAXONOMY</span>
                  </div>
                  <h2 className={`pdf-h2 text-2xl sm:text-3xl font-display font-bold tracking-tight ${t.heading}`}>
                    Technical Skills &amp; Architecture Disciplines
                  </h2>
                  <p className={`mt-1.5 text-xs sm:text-sm max-w-4xl ${t.muted}`}>
                    Enterprise expertise across multi-cloud infrastructure, autonomous agentic AI systems, Zero Trust security governance, and high-throughput telemetry pipelines.
                  </p>
                </div>

                {skillRows.map((row, rowIdx) => (
                  <div key={rowIdx} data-pdf-block className="pdf-keep-together">
                    <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 pdf-cols-2 gap-4">
                      {row.map((discipline) => (
                        <div
                          key={discipline.id}
                          className={`rounded-2xl border p-5 flex flex-col justify-between ${t.cardSubtle}`}
                        >
                          <div>
                            <div className={`flex items-center justify-between pb-3 border-b gap-2 ${t.divider}`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`p-1.5 rounded-lg border shrink-0 ${t.iconBoxDark}`}>
                                  {getDisciplineIcon(discipline.id)}
                                </div>
                                <span className={`font-display font-bold text-sm leading-tight ${t.heading}`}>
                                  {discipline.title}
                                </span>
                              </div>
                              <span className={`text-[9px] font-mono font-semibold tracking-wider px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ${t.accentBadge}`}>
                                {discipline.status}
                              </span>
                            </div>

                            {config.skillsDepth === 'full' && (
                              <p className={`text-xs mt-3 leading-relaxed font-light ${t.body}`}>
                                {discipline.description}
                              </p>
                            )}

                            <div className="mt-3.5 flex flex-wrap gap-1.5">
                              {(config.skillsDepth === 'compact'
                                ? discipline.technologies.slice(0, 5)
                                : discipline.technologies
                              ).map((tech, idx) => (
                                <span
                                  key={idx}
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono border ${t.chip}`}
                                >
                                  {tech}
                                </span>
                              ))}
                            </div>
                          </div>

                          {config.skillsDepth === 'full' && (
                            <div className={`pt-4 mt-4 border-t ${t.divider}`}>
                              <div className={`flex justify-between text-[10px] font-mono mb-1.5 ${t.muted}`}>
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className={`w-3 h-3 ${t.accent}`} />
                                  Production Maturity
                                </span>
                                <span className={`font-semibold ${t.accentLink}`}>{discipline.level}%</span>
                              </div>
                              <div className={`h-1.5 w-full rounded-full overflow-hidden border ${t.progressTrack}`}>
                                <div
                                  className={`h-full rounded-full ${t.progressBar}`}
                                  style={{ width: `${discipline.level}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* SECTION 5: LICENSES & OFFICIAL CERTIFICATIONS */}
          {config.sections.certifications && (
            <section
              data-pdf-section
              className={`pdf-section px-6 py-8 sm:px-10 sm:py-10 ${t.secA}`}
            >
              <div data-pdf-block data-pdf-keep-next className="pdf-keep-next mb-6">
                <div className={`inline-flex items-center gap-1.5 text-xs font-mono font-medium tracking-wider uppercase mb-1.5 ${t.accent}`}>
                  <Award className="w-3.5 h-3.5" />
                  <span>LICENSES &amp; OFFICIAL CERTIFICATIONS</span>
                </div>
                <h2 className={`pdf-h2 text-2xl sm:text-3xl font-display font-bold tracking-tight ${t.heading}`}>
                  Licenses &amp; Official Certifications ({totalVisibleCerts}
                  {config.certsDepth !== 'full' ? ` Featured of ${CERTIFICATIONS.length}` : ' Verified'})
                </h2>
                <p className={`mt-1.5 text-xs sm:text-sm max-w-4xl ${t.muted}`}>
                  Official verified credentials across enterprise cloud providers, architecture certifications, and AI disciplines. Verification directory:{' '}
                  <a
                    href="https://www.linkedin.com/in/mohammed-sufyan/details/certifications/"
                    target="_blank"
                    rel="noreferrer"
                    className={`hover:underline ${t.accentLink}`}
                  >
                    linkedin.com/in/mohammed-sufyan/details/certifications
                  </a>
                </p>
              </div>

              <div className="space-y-8">
                {visibleCertCategories.map((category) => {
                  const certRows = chunkArray(category.certs, 2);

                  return (
                    <div key={category.id} className="space-y-4">
                      <div
                        data-pdf-block
                        data-pdf-keep-next
                        className={`pdf-keep-next flex items-center gap-2.5 pb-2 border-b ${t.divider}`}
                      >
                        <div className={`w-2 h-2 rounded-full ${t.bulletDot}`}></div>
                        <h3 className={`text-base sm:text-lg font-display font-bold tracking-tight ${t.heading}`}>
                          {category.name}
                        </h3>
                        <span className={`text-[11px] font-mono border px-2 py-0.5 rounded ${t.accentBadge}`}>
                          {category.certs.length} Credentials
                        </span>
                      </div>

                      {certRows.map((row, rowIdx) => (
                        <div key={rowIdx} data-pdf-block className="pdf-keep-together">
                          <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 pdf-cols-2 gap-4">
                            {row.map((cert) => (
                              <div
                                key={cert.id}
                                className={`rounded-xl border p-4 flex flex-col justify-between ${t.cardSubtle}`}
                              >
                                <div>
                                  <div className={`flex items-center justify-between pb-2.5 border-b text-[10px] font-mono ${t.divider}`}>
                                    <span className={t.muted}>
                                      {cert.issueDate}
                                    </span>
                                    <span className={`flex items-center gap-1 font-medium ${t.emeraldText}`}>
                                      <CheckCircle className="w-3 h-3" />
                                      Verified
                                    </span>
                                  </div>

                                  <div className="mt-2.5 flex items-center gap-1.5">
                                    <IssuerMark issuer={cert.issuer} size="sm" theme={cvTheme} />
                                    <span className={`text-[10px] font-mono font-medium tracking-wide uppercase truncate ${t.accent}`}>
                                      {cert.issuer}
                                    </span>
                                  </div>

                                  <h4 className={`text-sm font-display font-bold mt-0.5 leading-snug ${t.heading}`}>
                                    {cert.title}
                                  </h4>

                                  <div className={`mt-2 text-[10px] font-mono break-all ${t.muted}`}>
                                    {cert.credentialId ? (
                                      <>ID: <span className={t.body}>{cert.credentialId}</span></>
                                    ) : (
                                      <span>Official Accreditation Record</span>
                                    )}
                                  </div>

                                  <div className="mt-2.5 flex flex-wrap gap-1">
                                    {cert.skills.map((skill, sIdx) => (
                                      <span
                                        key={sIdx}
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${t.chipMuted}`}
                                      >
                                        {skill}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div className={`pt-2.5 mt-3 border-t text-[10px] font-mono ${t.divider}`}>
                                  <a
                                    href={cert.credentialUrl || 'https://www.linkedin.com/in/mohammed-sufyan/details/certifications/'}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`inline-flex items-center gap-1 hover:underline break-all ${t.accentLink}`}
                                  >
                                    <span>{cert.credentialUrl || 'https://www.linkedin.com/in/mohammed-sufyan/details/certifications/'}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* SECTION 6: OFFICIAL RECOGNITIONS & HONORS + LINKEDIN RECOMMENDATIONS */}
          {config.sections.awards && (
            <section
              data-pdf-section
              className={`pdf-section px-6 py-8 sm:px-10 sm:py-10 ${t.secB}`}
            >
              <div data-pdf-block data-pdf-keep-next className="pdf-keep-next mb-6">
                <div className={`inline-flex items-center gap-1.5 text-xs font-mono font-medium tracking-wider uppercase mb-1.5 ${t.accent}`}>
                  <Trophy className="w-3.5 h-3.5" />
                  <span>OFFICIAL RECOGNITIONS &amp; HONORS</span>
                </div>
                <h2 className={`pdf-h2 text-2xl sm:text-3xl font-display font-bold tracking-tight ${t.heading}`}>
                  Official Recognitions &amp; Honors ({totalVisibleAwards}
                  {config.awardsDepth === 'featured' ? ` Selected of ${AWARDS.length}` : ' Citations'})
                </h2>
                <p className={`mt-1.5 text-xs sm:text-sm max-w-4xl ${t.muted}`}>
                  Peer endorsements, corporate excellence citations, and leadership awards across{' '}
                  <span className="sm:hidden print:hidden">Cisco</span>
                  <span className="hidden sm:inline print:inline">Cisco Systems Inc.</span>
                  , HCL America Inc./HCLTech, and Tata Consultancy Services.
                </p>
              </div>

              <div className="space-y-8">
                {visibleAwardsGroups.map((group) => {
                  const awardRows = chunkArray(group.awards, 3);

                  return (
                    <div key={group.organization} className="space-y-3.5">
                      <div
                        data-pdf-block
                        data-pdf-keep-next
                        className={`pdf-keep-next flex flex-col sm:flex-row pdf-row-sm sm:items-center justify-between gap-2 pb-2.5 border-b ${t.divider}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-lg border ${t.accentBadge}`}>
                            <Building2 className={`w-4 h-4 ${t.accent}`} />
                          </div>
                          <div>
                            <h3 className={`text-base sm:text-lg font-display font-bold tracking-tight ${t.heading}`}>
                              {group.organization}
                            </h3>
                            <div className={`text-[10px] font-mono ${t.muted}`}>
                              {group.tagline}
                            </div>
                          </div>
                        </div>
                        <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded border self-start sm:self-auto ${t.accentBadge}`}>
                          {group.awards.length} Honors Conferred
                        </span>
                      </div>

                      {awardRows.map((row, rowIdx) => (
                        <div key={rowIdx} data-pdf-block className="pdf-keep-together">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 pdf-cols-3 gap-3.5">
                            {row.map((award) => (
                              <div
                                key={award.id}
                                className={`rounded-xl border p-4 flex flex-col justify-between ${t.cardSubtle}`}
                              >
                                <div>
                                  <div className={`flex items-center justify-between pb-2.5 border-b ${t.divider}`}>
                                    <span className={`text-[10px] font-mono font-semibold tracking-wider ${t.accent}`}>
                                      {award.date}
                                    </span>
                                    <span className={`p-1 rounded-md border ${t.starBadge}`}>
                                      <Star className="w-3 h-3 fill-current opacity-80" />
                                    </span>
                                  </div>

                                  <h4 className={`text-sm font-display font-bold mt-2.5 leading-snug ${t.heading}`}>
                                    {award.title}
                                  </h4>

                                  <div className={`mt-1 text-[11px] font-mono ${t.accentSoft}`}>
                                    {award.category}
                                  </div>

                                  <p className={`text-[11px] mt-2 leading-relaxed font-light ${t.body}`}>
                                    {award.description}
                                  </p>
                                </div>

                                <div className={`pt-2.5 mt-3 border-t flex items-center justify-between text-[10px] font-mono ${t.divider} ${t.muted}`}>
                                  <span className="flex items-center gap-1 truncate">
                                    <Medal className={`w-3 h-3 shrink-0 ${t.medalColor}`} />
                                    <span className="truncate">
                                      {award.associatedWith ? `Associated with ${award.associatedWith}` : 'Official Citation'}
                                    </span>
                                  </span>
                                  <span className={`shrink-0 ml-1 ${t.emeraldText}`}>Awarded</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* LinkedIn Recommendations Sub-Section */}
              <div className="mt-8 space-y-4">
                <div
                  data-pdf-block
                  data-pdf-keep-next
                  className={`pdf-keep-next flex flex-col sm:flex-row pdf-row-sm sm:items-center justify-between gap-2 pb-2.5 border-b ${t.divider}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg border ${t.accentBadge}`}>
                      <Linkedin className={`w-4 h-4 ${t.accent}`} />
                    </div>
                    <div>
                      <h3 className={`text-base sm:text-lg font-display font-bold tracking-tight ${t.heading}`}>
                        Verified LinkedIn Recommendations ({visibleRecommendations.length}
                        {config.awardsDepth === 'featured'
                          ? ` Featured of ${LINKEDIN_RECOMMENDATIONS.length}`
                          : ' Verified'}
                        )
                      </h3>
                      <div className={`text-[10px] font-mono ${t.muted}`}>
                        Direct managers, reports, and cross-functional engineering peers across{' '}
                        <span className="sm:hidden print:hidden">Cisco</span>
                        <span className="hidden sm:inline print:inline">Cisco Systems Inc.</span>
                        , Apple, Actian &amp; TCS
                      </div>
                    </div>
                  </div>
                  <a
                    href="https://www.linkedin.com/in/mohammed-sufyan/details/recommendations/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 text-[11px] font-mono hover:underline self-start sm:self-auto ${t.accentLink}`}
                  >
                    <span>Verify on LinkedIn</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>

                {recommendationRows.map((row, rowIdx) => (
                  <div key={rowIdx} data-pdf-block className="pdf-keep-together">
                    <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 pdf-cols-2 gap-3.5">
                      {row.map((rec) => {
                        const relLabel =
                          rec.relationshipType === 'manager'
                            ? 'Direct Manager'
                            : rec.relationshipType === 'direct_report'
                              ? 'Direct Report'
                              : 'Peer / Lead';
                        const relStyle =
                          rec.relationshipType === 'manager'
                            ? t.emeraldBadge
                            : rec.relationshipType === 'direct_report'
                              ? t.starBadge
                              : t.accentBadge;

                        return (
                          <div
                            key={rec.id}
                            className={`rounded-xl border p-4 flex flex-col justify-between ${t.cardSubtle}`}
                          >
                            <div>
                              <div className={`flex items-start justify-between gap-2 pb-2.5 border-b ${t.divider}`}>
                                <div className="min-w-0">
                                  <h4 className={`text-xs sm:text-sm font-display font-bold leading-snug ${t.heading}`}>
                                    {rec.author}
                                  </h4>
                                  <div className={`text-[10px] leading-snug mt-0.5 line-clamp-2 ${t.muted}`}>
                                    {rec.role}
                                  </div>
                                </div>
                                <span
                                  className={`shrink-0 px-2 py-0.5 rounded border text-[9px] font-mono font-semibold uppercase tracking-wide ${relStyle}`}
                                >
                                  {relLabel}
                                </span>
                              </div>

                              <div className="mt-2.5 flex items-start gap-2">
                                <Quote className={`w-3.5 h-3.5 shrink-0 mt-0.5 opacity-70 ${t.accent}`} />
                                <p className={`text-[11px] leading-relaxed font-light ${t.body}`}>
                                  {rec.quote}
                                </p>
                              </div>
                            </div>

                            <div className={`pt-2 mt-2.5 border-t flex items-center justify-between text-[10px] font-mono ${t.divider} ${t.muted}`}>
                              <span className="truncate">{rec.relationship}</span>
                              <span className={`shrink-0 ml-2 ${t.accent}`}>{rec.date}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Verification Banner Link */}
                <div
                  data-pdf-block
                  className={`pdf-keep-together rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row pdf-row-sm sm:items-center justify-between gap-3 ${t.verifyBox}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${t.accentBadge}`}>
                      <Linkedin className={`w-4 h-4 ${t.accent}`} />
                    </div>
                    <div>
                      <div className={`text-[10px] font-mono uppercase tracking-wider ${t.accent}`}>
                        Full Endorsement Archive ({LINKEDIN_RECOMMENDATIONS.length} Verified)
                      </div>
                      <div className={`text-xs font-medium ${t.subheading}`}>
                        Inspect original signed endorsements directly on LinkedIn
                      </div>
                    </div>
                  </div>

                  <a
                    href="https://www.linkedin.com/in/mohammed-sufyan/details/recommendations/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-mono hover:underline whitespace-nowrap shrink-0 ${t.accentBadge}`}
                  >
                    <span>linkedin.com/in/mohammed-sufyan/details/recommendations</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              </div>
            </section>
          )}

          {/* SECTION 7: EDUCATION & SCHOLASTIC HONORS */}
          {config.sections.education && (
            <section
              data-pdf-section
              className={`pdf-section px-6 py-8 sm:px-10 sm:py-10 ${t.secA}`}
            >
              <div className="space-y-6">
                <div data-pdf-block data-pdf-keep-next className="pdf-keep-next">
                  <div className={`inline-flex items-center gap-1.5 text-xs font-mono font-medium tracking-wider uppercase mb-1.5 ${t.accent}`}>
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>ACADEMIC FOUNDATION</span>
                  </div>
                  <h2 className={`pdf-h2 text-2xl sm:text-3xl font-display font-bold tracking-tight ${t.heading}`}>
                    Education &amp; Scholastic Honors
                  </h2>
                  <p className={`mt-1.5 text-xs sm:text-sm max-w-4xl ${t.muted}`}>
                    Formal engineering pedagogy grounded in computer science, distributed algorithms, discrete mathematics, and applied sciences.
                  </p>
                </div>

                <div
                  data-pdf-block
                  className="pdf-keep-together grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 pdf-cols-2 gap-5"
                >
                  {EDUCATION.map((edu, idx) => (
                    <div
                      key={idx}
                      className={`rounded-2xl border p-5 sm:p-6 flex flex-col justify-between ${t.cardSubtle}`}
                    >
                      <div>
                        <div className={`flex items-center justify-between pb-3 border-b gap-2 ${t.divider}`}>
                          <span className={`flex items-center gap-1.5 text-xs font-mono ${t.accent}`}>
                            <Calendar className="w-3.5 h-3.5" />
                            {edu.period}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wide border ${t.emeraldBadge}`}>
                            {edu.grade}
                          </span>
                        </div>

                        <h3 className={`text-lg font-display font-bold mt-3.5 leading-snug ${t.heading}`}>
                          {edu.degree}
                        </h3>
                        <div className={`text-xs sm:text-sm font-medium mt-1 ${t.accent}`}>
                          {edu.field}
                        </div>

                        <div className={`mt-2.5 flex flex-wrap items-center gap-2 text-xs font-mono ${t.muted}`}>
                          <span>{edu.institution}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <MapPin className={`w-3 h-3 ${t.subtle}`} />
                            {edu.location}
                          </span>
                        </div>

                        <p className={`text-xs mt-3 leading-relaxed font-light ${t.body}`}>
                          {edu.details}
                        </p>
                      </div>

                      <div className={`pt-3 mt-4 border-t flex items-center justify-between text-[11px] font-mono ${t.divider} ${t.muted}`}>
                        <span className="flex items-center gap-1.5">
                          <Award className={`w-3.5 h-3.5 ${t.accent}`} />
                          Accredited University Degree
                        </span>
                        <span className={t.subtle}>Graduated</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* SECTION 8: CONTACT FOOTER */}
          {selectedSectionCount > 0 && (
            <section
              data-pdf-section
              className={`pdf-section px-6 py-6 sm:px-10 sm:py-8 ${t.secFooter}`}
            >
              <div
                data-pdf-block
                className={`pdf-keep-together pdf-footer-row flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] font-mono ${t.muted}`}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`font-bold ${t.heading}`}>{PERSONAL_INFO.name}</span>
                  <span>·</span>
                  <a href={`mailto:${PERSONAL_INFO.email}`} className={`break-all ${isLight ? 'hover:text-sky-700' : 'hover:text-cyan-300'}`}>
                    {PERSONAL_INFO.email}
                  </a>
                  <span>·</span>
                  <a href={PERSONAL_INFO.linkedin} target="_blank" rel="noopener noreferrer" className={`hover:underline break-all ${t.accentLink}`}>
                    linkedin.com/in/mohammed-sufyan
                  </a>
                  <span>·</span>
                  <a
                    href="https://www.linkedin.com/in/mohammed-sufyan/details/recommendations/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`hover:underline break-all ${t.accentLink}`}
                  >
                    Recommendations
                  </a>
                </div>
                <div className={t.subtle}>
                  Zero Trust Distributed Systems · Multi-Cloud Architecture · San Jose, CA
                </div>
              </div>
            </section>
          )}
        </div>

          </motion.div>
        </motion.div>
      )}

      <AccessGateModal
        action={pendingAction === 'install' ? null : pendingAction}
        formatLabel={getFormatLabel()}
        isLight={isLight}
        onClose={() => setPendingAction(null)}
        onVerified={handleAccessVerified}
      />
    </AnimatePresence>
  );
}
