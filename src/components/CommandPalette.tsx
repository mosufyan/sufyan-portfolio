import { Linkedin } from './icons/Linkedin';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Briefcase,
  Compass,
  CornerDownLeft,
  Cpu,
  Download,
  ExternalLink,
  GraduationCap,
  Mail,
  Megaphone,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trophy,
  X
} from 'lucide-react';
import { downloadVCard } from '../utils/vcard';
import { AnimatePresence, motion } from 'motion/react';
import {
  AWARDS,
  CERTIFICATIONS,
  Certification,
  LINKEDIN_RECOMMENDATIONS,
  PERSONAL_INFO,
  TECHNICAL_DISCIPLINES,
  WORK_EXPERIENCE,
} from '../data/portfolioData';
import { useTheme } from '../theme/ThemeProvider';
import ModalHeaderScan from './ModalHeaderScan';
import { EASE_OUT_EXPO } from './MotionPrimitives';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSkill: (skill: string | null) => void;
  onSelectCertification: (cert: Certification) => void;
  onFocusCompany: (company: string) => void;
  onOpenResume: () => void;
  onOpenAnnouncements: () => void;
  onOpenDigitalCard?: () => void;
  onOpenTerminal?: () => void;
}

interface PaletteItem {
  id: string;
  group: 'Actions' | 'Sections' | 'Skills' | 'Experience' | 'Certifications' | 'Honors';
  title: string;
  subtitle: string;
  keywords: string;
  action: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onSelectSkill,
  onSelectCertification,
  onFocusCompany,
  onOpenResume,
  onOpenAnnouncements,
  onOpenDigitalCard,
  onOpenTerminal,
}: CommandPaletteProps) {
  const { isLight } = useTheme();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const jumpToSection = (id: string) => {
    onClose();
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  const allItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [
      {
        id: 'act-cv',
        group: 'Actions',
        title: 'Download, Print, or Copy ATS Official CV',
        subtitle: 'Open executive CV preview, PDF, Light Paper print & ATS text',
        keywords: 'resume pdf print download cv ats plain text light paper',
        action: () => {
          onClose();
          onOpenResume();
        },
      },
      {
        id: 'act-vcard',
        group: 'Actions',
        title: 'Open Digital Business Card & QR Code',
        subtitle: 'Scan QR for www.mohammedsufyan.com or save contact (.vcf)',
        keywords: 'qr code business card vcard vcf contact share',
        action: () => {
          onClose();
          if (onOpenDigitalCard) {
            onOpenDigitalCard();
          } else {
            downloadVCard();
          }
        },
      },
      {
        id: 'act-announcements',
        group: 'Actions',
        title: 'View Latest Career Announcements',
        subtitle: 'Cisco Systems Inc. STO launch, Databricks & ERS awards',
        keywords: 'news updates announcements',
        action: () => {
          onClose();
          onOpenAnnouncements();
        },
      },
      {
        id: 'act-email',
        group: 'Actions',
        title: `Copy Email (${PERSONAL_INFO.email})`,
        subtitle: 'Copy direct contact email to clipboard',
        keywords: 'contact mail email copy',
        action: () => {
          navigator.clipboard?.writeText(PERSONAL_INFO.email).catch(() => {});
          onClose();
        },
      },
      {
        id: 'act-linkedin-recs',
        group: 'Actions',
        title: 'View LinkedIn Recommendations',
        subtitle: 'Open peer & manager endorsements on LinkedIn',
        keywords: 'linkedin testimonials endorsements recommendations',
        action: () => {
          const anchor = document.createElement('a');
          anchor.href = 'https://www.linkedin.com/in/mohammed-sufyan/details/recommendations/';
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          anchor.click();
          onClose();
        },
      },
      {
        id: 'sec-overview',
        group: 'Sections',
        title: 'Overview & Executive Summary',
        subtitle: 'Hero metrics & quick actions',
        keywords: 'home top hero overview stats',
        action: () => jumpToSection('overview'),
      },
      {
        id: 'act-terminal',
        group: 'Actions',
        title: 'Launch Interactive Terminal (sufyanctl)',
        subtitle: 'Run CLI queries for certs, career trace, awards & vCard export',
        keywords: 'terminal cli shell console sufyanctl commands',
        action: () => {
          onClose();
          onOpenTerminal?.();
        },
      },
      {
        id: 'sec-philosophy',
        group: 'Sections',
        title: 'Personal Profile & Engineering Philosophy',
        subtitle: 'Architectural pillars & guiding creed',
        keywords: 'philosophy about creed profile',
        action: () => jumpToSection('philosophy'),
      },
      {
        id: 'sec-experience',
        group: 'Sections',
        title: 'Professional Experience & Leadership',
        subtitle: '13+ years across Cisco Systems Inc., HCL America Inc./HCLTech & TCS',
        keywords: 'experience timeline career work history',
        action: () => jumpToSection('experience'),
      },
      {
        id: 'sec-skills',
        group: 'Sections',
        title: 'Technical Skills & Disciplines',
        subtitle: 'AI, Python, Multi-Cloud, DevOps & Zero Trust',
        keywords: 'skills tech stack disciplines',
        action: () => jumpToSection('skills'),
      },
      {
        id: 'action-clear-skills',
        group: 'Actions',
        title: 'Clear all skill filters',
        subtitle: 'Reset multi-select cross-filtering on Experience & Certifications',
        keywords: 'clear reset skill filter skills remove',
        action: () => {
          onSelectSkill(null);
          jumpToSection('skills');
        },
      },
      {
        id: 'sec-certifications',
        group: 'Sections',
        title: 'Licenses & Official Certifications',
        subtitle: '20 verified credentials across AWS, Azure, GCP & Databricks',
        keywords: 'certifications licenses credentials',
        action: () => jumpToSection('certifications'),
      },
      {
        id: 'sec-honors',
        group: 'Sections',
        title: 'Official Recognitions & Honors',
        subtitle: '20 corporate awards & LinkedIn recommendations',
        keywords: 'awards honors recognitions',
        action: () => jumpToSection('honors'),
      },
      {
        id: 'sec-education',
        group: 'Sections',
        title: 'Education & Scholastic Honors',
        subtitle: 'B.E. Computer Science (9.5/10 CGPA)',
        keywords: 'education university degree vtu',
        action: () => jumpToSection('education'),
      },
      {
        id: 'sec-contact',
        group: 'Sections',
        title: 'Transmit Message / Contact',
        subtitle: 'Direct secure inquiry form',
        keywords: 'contact message inquiry form',
        action: () => jumpToSection('contact'),
      },
    ];

    for (const comp of WORK_EXPERIENCE) {
      for (const role of comp.roles) {
        items.push({
          id: `exp-${comp.company}-${role.role}-${role.period}`,
          group: 'Experience',
          title: `${role.role} · ${comp.company}`,
          subtitle: `${role.period} · ${role.location}`,
          keywords: `${comp.company} ${role.role} ${role.domain || ''} ${role.technologies.join(' ')}`,
          action: () => {
            onFocusCompany(comp.company);
            jumpToSection('experience');
          },
        });
      }
    }

    const seenSkills = new Set<string>();
    for (const disc of TECHNICAL_DISCIPLINES) {
      for (const tech of disc.technologies) {
        if (seenSkills.has(tech)) continue;
        seenSkills.add(tech);
        items.push({
          id: `skill-${tech}`,
          group: 'Skills',
          title: `Add skill filter: ${tech}`,
          subtitle: `${disc.title} · Multi-select cross-filter Experience & Certifications`,
          keywords: `${tech} ${disc.title}`,
          action: () => {
            onSelectSkill(tech);
            jumpToSection('experience');
          },
        });
      }
    }

    for (const cert of CERTIFICATIONS) {
      items.push({
        id: `cert-${cert.id}`,
        group: 'Certifications',
        title: cert.title,
        subtitle: `${cert.issuer} · ${cert.issueDate}`,
        keywords: `${cert.title} ${cert.issuer} ${cert.skills.join(' ')} ${cert.credentialId || ''}`,
        action: () => {
          onClose();
          onSelectCertification(cert);
        },
      });
    }

    for (const award of AWARDS) {
      items.push({
        id: `award-${award.id}`,
        group: 'Honors',
        title: award.title,
        subtitle: `${award.organization} · ${award.date}`,
        keywords: `${award.title} ${award.organization} ${award.category} ${award.description}`,
        action: () => jumpToSection('honors'),
      });
    }

    for (const rec of LINKEDIN_RECOMMENDATIONS) {
      items.push({
        id: `rec-${rec.id}`,
        group: 'Honors',
        title: `Endorsement: ${rec.author}`,
        subtitle: `${rec.role} · ${rec.relationship}`,
        keywords: `${rec.author} ${rec.role} ${rec.relationship} ${rec.quote} recommendation endorsement`,
        action: () => jumpToSection('linkedin-recommendations'),
      });
    }

    return items;
  }, [onClose, onFocusCompany, onOpenAnnouncements, onOpenDigitalCard, onOpenResume, onOpenTerminal, onSelectCertification, onSelectSkill]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return allItems.slice(0, 14);
    }
    const terms = q.split(/\s+/).filter(Boolean);
    return allItems
      .filter((item) => {
        const hay = `${item.title} ${item.subtitle} ${item.keywords} ${item.group}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      })
      .slice(0, 20);
  }, [allItems, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const activeEl = listRef.current?.querySelector(`[data-palette-index="${activeIndex}"]`);
    if (activeEl instanceof HTMLElement) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0
      );
      return;
    }
    if (e.key === 'Enter' && filteredItems[activeIndex]) {
      e.preventDefault();
      filteredItems[activeIndex].action();
    }
  };

  const getGroupIcon = (group: PaletteItem['group'], id: string) => {
    if (id === 'act-cv') return <Download className="w-4 h-4 text-cyan-400" />;
    if (id === 'act-vcard') return <QrCode className="w-4 h-4 text-cyan-400" />;
    if (id === 'act-announcements') return <Megaphone className="w-4 h-4 text-cyan-400" />;
    if (id === 'act-email') return <Mail className="w-4 h-4 text-cyan-400" />;
    if (id === 'act-linkedin-recs') return <Linkedin className="w-4 h-4 text-cyan-400" />;
    if (id === 'act-terminal') return <Terminal className="w-4 h-4 text-cyan-400" />;
    switch (group) {
      case 'Actions':
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
      case 'Sections':
        if (id === 'sec-philosophy') return <Compass className="w-4 h-4 text-sky-400" />;
        if (id === 'sec-education') return <GraduationCap className="w-4 h-4 text-sky-400" />;
        return <Sparkles className="w-4 h-4 text-sky-400" />;
      case 'Skills':
        return <Cpu className="w-4 h-4 text-purple-400" />;
      case 'Experience':
        return <Briefcase className="w-4 h-4 text-cyan-400" />;
      case 'Certifications':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'Honors':
        return <Trophy className="w-4 h-4 text-amber-400" />;
      default:
        return <Award className="w-4 h-4 text-cyan-400" />;
    }
  };

  const panel = isLight
    ? 'border-slate-200 bg-white text-slate-800 shadow-2xl shadow-slate-300/40'
    : 'border-slate-700/80 bg-[#0a0f1c] text-slate-200 shadow-2xl shadow-cyan-950/40';
  const rowActive = isLight
    ? 'bg-sky-50 border border-sky-300 text-slate-900'
    : 'bg-cyan-500/15 border border-cyan-500/40 text-white';
  const rowIdle = isLight
    ? 'border border-transparent text-slate-700 hover:bg-slate-50'
    : 'border border-transparent text-slate-300 hover:bg-slate-900/70';
  const iconBox = isLight
    ? 'bg-slate-50 border-slate-200'
    : 'bg-[#0d1424] border-slate-800';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const subtitleCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const metaCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const accent = isLight ? 'text-sky-700' : 'text-cyan-400';
  const emptyCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const footer = isLight
    ? 'border-slate-200 bg-slate-50 text-slate-500'
    : 'border-slate-800/80 bg-[#070b14] text-slate-500';
  const backdrop = isLight ? 'bg-slate-900/45' : 'bg-slate-950/80';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          className={`fixed inset-0 z-50 flex items-start justify-center backdrop-blur-sm px-3 sm:px-4 pt-[max(4rem,env(safe-area-inset-top))] sm:pt-24 pb-[max(2rem,env(safe-area-inset-bottom))] overflow-y-auto print:hidden ${backdrop}`}
          role="dialog"
          aria-modal="true"
          aria-label="Quick command palette"
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            className={`command-palette w-full max-w-2xl rounded-2xl border overflow-hidden ${panel}`}
          >
            {/* Search bar only — always dark for brand consistency */}
            <div className="relative flex items-center gap-3 px-4 py-3.5 border-b border-slate-800/90 bg-[#070b14]">
              <ModalHeaderScan active={isOpen} />
              <Search className="w-4 h-4 text-cyan-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to section, filter skill (e.g. AWS, RAG), search certs or roles..."
                aria-label="Search commands, skills, roles, and certifications"
                className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-xs font-mono text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close quick navigation"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results list — follows site theme */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
              {filteredItems.length > 0 ? (
                filteredItems.map((item, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-palette-index={idx}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={item.action}
                      className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-left transition-colors ${
                        isActive ? rowActive : rowIdle
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${iconBox}`}>
                          {getGroupIcon(item.group, item.id)}
                        </div>
                        <div className="min-w-0">
                          <div className={`text-xs sm:text-sm font-medium truncate ${titleCls}`}>
                            {item.title}
                          </div>
                          <div className={`text-[11px] font-mono truncate ${subtitleCls}`}>
                            {item.subtitle}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-mono uppercase tracking-wider ${metaCls}`}>
                          {item.group}
                        </span>
                        {item.id === 'act-linkedin-recs' ? (
                          <ExternalLink className={`w-3.5 h-3.5 ${accent}`} />
                        ) : (
                          isActive && <CornerDownLeft className={`w-3.5 h-3.5 ${accent}`} />
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className={`py-10 text-center text-xs font-mono ${emptyCls}`}>
                  No matches found for &ldquo;{query}&rdquo;. Try &ldquo;AWS&rdquo;, &ldquo;Project Atlas&rdquo;, &ldquo;Databricks&rdquo;, or &ldquo;CV&rdquo;.
                </div>
              )}
            </div>

            {/* Footer Hints — follows site theme */}
            <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t text-[11px] font-mono ${footer}`}>
              <div className="flex items-center gap-3">
                <span>↑↓ Navigate</span>
                <span>↵ Open / Filter</span>
                <span>Esc Close</span>
              </div>
              <span>⌘K / Ctrl+K</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
