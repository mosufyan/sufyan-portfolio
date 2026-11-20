import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Terminal, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AWARDS,
  CERTIFICATIONS,
  LINKEDIN_RECOMMENDATIONS,
  PERSONAL_INFO,
  WORK_EXPERIENCE,
} from '../data/portfolioData';
import { downloadVCard } from '../utils/vcard';
import { useTheme } from '../theme/ThemeProvider';
import { useModalPlacement } from '../hooks/useModalPlacement';
import { EASE_OUT_EXPO } from './MotionPrimitives';

interface EngineeringTerminalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenResume: () => void;
  onOpenDigitalCard: () => void;
}

interface TerminalEntry {
  id: number;
  command?: string;
  lines: string[];
  tone?: 'default' | 'accent' | 'error';
}

const QUICK_COMMANDS = [
  'whoami',
  'ls certs --cloud=aws',
  'trace career --company=cisco',
  'cat philosophy.txt',
  'recs',
  'export --vcard',
] as const;

export default function EngineeringTerminal({
  isOpen,
  onClose,
  onOpenResume,
  onOpenDigitalCard,
}: EngineeringTerminalProps) {
  const { isLight } = useTheme();
  const alignClass = useModalPlacement(isOpen);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [entries, setEntries] = useState<TerminalEntry[]>([
    {
      id: 1,
      tone: 'accent',
      lines: [
        'sufyanctl v2.0 — Mohammed Sufyan Interactive Engineering Console',
        'Type "help" for available commands or click a preset below.',
      ],
    },
  ]);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextIdRef = useRef(2);

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => inputRef.current?.focus());

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const appendEntry = (command: string | undefined, lines: string[], tone: TerminalEntry['tone'] = 'default') => {
    const id = nextIdRef.current++;
    setEntries((prev) => [...prev, { id, command, lines, tone }]);
  };

  const scrollToSection = (sectionId: string) => {
    onClose();
    requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const executeCommand = (rawCommand: string) => {
    const cmd = rawCommand.trim();
    if (!cmd) return;

    setHistory((prev) => [cmd, ...prev.slice(0, 29)]);
    setHistoryIndex(-1);

    const lower = cmd.toLowerCase();
    const parts = lower.split(/\s+/);
    const root = parts[0];

    if (lower === 'clear' || lower === 'cls') {
      setEntries([]);
      return;
    }

    if (lower === 'help' || lower === '?') {
      appendEntry(cmd, [
        'Available commands:',
        '  whoami                        Profile, Cisco STO role, and location',
        '  ls certs [--cloud=aws|azure|gcp|databricks|ai]  List verified credentials',
        '  trace career [--company=cisco|hcl|tcs]          Show timeline & proof metrics',
        '  ls awards                     List top honors & awards (20+ total)',
        '  recs                          Show LinkedIn peer & manager endorsements',
        '  cat philosophy.txt            Print engineering philosophy & creed',
        '  export --vcard                Download Mohammed_Sufyan.vcf contact card',
        '  open <cv|card|experience|certs|contact>         Open modal or jump to section',
        '  clear                         Clear console output',
      ], 'accent');
      return;
    }

    if (lower === 'whoami') {
      appendEntry(cmd, [
        `${PERSONAL_INFO.name} — ${PERSONAL_INFO.title}`,
        `Location   : ${PERSONAL_INFO.location}`,
        `Experience : ${PERSONAL_INFO.experienceYears} years across US, UK, and India`,
        `Credentials: ${CERTIFICATIONS.length} verified · ${AWARDS.length}+ corporate awards · ${LINKEDIN_RECOMMENDATIONS.length} recommendations`,
        `Contact    : ${PERSONAL_INFO.email}`,
      ]);
      return;
    }

    if (lower.startsWith('ls certs')) {
      const cloudArg = parts.find((p) => p.startsWith('--cloud='))?.split('=')[1];
      const matches = CERTIFICATIONS.filter((cert) => {
        if (!cloudArg || cloudArg === 'all') return true;
        const issuer = cert.issuer.toLowerCase();
        if (cloudArg === 'aws') return issuer.includes('amazon');
        if (cloudArg === 'azure' || cloudArg === 'microsoft') return issuer.includes('microsoft');
        if (cloudArg === 'gcp' || cloudArg === 'google') return issuer.includes('google');
        if (cloudArg === 'databricks') return issuer.includes('databricks');
        if (cloudArg === 'ai') return cert.category === 'ai';
        return true;
      });
      if (matches.length === 0) {
        appendEntry(cmd, [`No certifications matched filter "--cloud=${cloudArg}".`], 'error');
        return;
      }
      appendEntry(
        cmd,
        [
          `Found ${matches.length} verified credential(s):`,
          ...matches.map(
            (c) => `  • [${c.issueDate}] ${c.title} — ${c.issuer}${c.credentialId ? ` (${c.credentialId})` : ''}`
          ),
        ]
      );
      return;
    }

    if (lower.startsWith('trace career')) {
      const companyArg = parts.find((p) => p.startsWith('--company='))?.split('=')[1];
      const companies = WORK_EXPERIENCE.filter((comp) => {
        if (!companyArg) return true;
        const name = comp.company.toLowerCase();
        if (companyArg === 'cisco') return name.includes('cisco');
        if (companyArg === 'hcl') return name.includes('hcl');
        if (companyArg === 'tcs' || companyArg === 'tata') return name.includes('tata');
        return name.includes(companyArg);
      });
      if (companies.length === 0) {
        appendEntry(cmd, [`No career entries found for "--company=${companyArg}".`], 'error');
        return;
      }
      const lines: string[] = [];
      for (const comp of companies) {
        lines.push(`▸ ${comp.company} (${comp.tenure} · ${comp.location})`);
        for (const r of comp.roles) {
          lines.push(`    - ${r.role} [${r.period}]`);
          if (r.proofMetric) lines.push(`      proof: ${r.proofMetric}`);
        }
      }
      appendEntry(cmd, lines);
      return;
    }

    if (lower === 'ls awards') {
      appendEntry(cmd, [
        `Recent Corporate Honors (${AWARDS.length} documented):`,
        ...AWARDS.slice(0, 8).map((a) => `  ★ ${a.date} — ${a.title} (${a.organization})`),
        `  ... plus ${Math.max(0, AWARDS.length - 8)} additional honors in #honors.`,
      ]);
      return;
    }

    if (lower.startsWith('recs')) {
      const featured = LINKEDIN_RECOMMENDATIONS.filter((r) => r.featured).slice(0, 3);
      appendEntry(cmd, [
        `${LINKEDIN_RECOMMENDATIONS.length} Verified LinkedIn Recommendations:`,
        ...featured.map(
          (r) => `  "${r.quote.slice(0, 145)}..." — ${r.author} (${r.role})`
        ),
      ]);
      return;
    }

    if (lower === 'cat philosophy.txt' || lower === 'philosophy') {
      appendEntry(cmd, [
        `"${PERSONAL_INFO.philosophy.quote1}"`,
        '',
        PERSONAL_INFO.philosophy.body,
        '',
        ...PERSONAL_INFO.philosophy.poem.split('\n').map((l) => `  ${l}`),
      ]);
      return;
    }

    if (lower === 'export --vcard' || lower === 'vcard') {
      downloadVCard();
      appendEntry(cmd, ['Downloaded Mohammed_Sufyan.vcf contact card.'], 'accent');
      return;
    }

    if (root === 'open' || root === 'goto') {
      const target = parts[1];
      if (target === 'cv' || target === 'resume') {
        onClose();
        onOpenResume();
        return;
      }
      if (target === 'card' || target === 'qr') {
        onClose();
        onOpenDigitalCard();
        return;
      }
      const sectionMap: Record<string, string> = {
        overview: 'overview',
        philosophy: 'philosophy',
        experience: 'experience',
        skills: 'skills',
        certs: 'certifications',
        certifications: 'certifications',
        honors: 'honors',
        awards: 'honors',
        education: 'education',
        contact: 'contact',
      };
      if (target && sectionMap[target]) {
        scrollToSection(sectionMap[target]);
        return;
      }
      appendEntry(cmd, ['Usage: open <cv|card|experience|skills|certs|honors|contact>'], 'error');
      return;
    }

    appendEntry(cmd, [`Command not found: "${cmd}". Type "help" for available commands.`], 'error');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const current = input;
    setInput('');
    executeCommand(current);
  };

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className={`fixed inset-0 z-50 flex ${alignClass} justify-center backdrop-blur-sm p-2.5 sm:p-5 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] overflow-y-auto print:hidden ${
            isLight ? 'bg-slate-900/45' : 'bg-black/75'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Engineering Terminal"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-3xl 2xl:max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[min(calc(100dvh-1.5rem),35.5rem)] sm:max-h-[min(calc(100dvh-2.5rem),36rem)] lg:max-h-[min(calc(100dvh-3rem),46rem)] ${
              isLight
                ? 'border-slate-300 bg-white text-slate-800'
                : 'border-slate-700/90 bg-[#070b14] text-slate-200'
            }`}
          >
            {/* Header Bar (fixed dark brand chrome in both light and dark modes) */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#0a0f1c]">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-300">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>sufyanctl · interactive portfolio shell</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close terminal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Clickable Preset Commands */}
            <div
              className={`shrink-0 px-4 py-2 border-b flex items-center gap-1.5 ${
                isLight
                  ? 'border-slate-200 bg-slate-50'
                  : 'border-slate-800/80 bg-[#080d18]'
              }`}
            >
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 shrink-0 mr-1">
                Presets:
              </span>
              <div className="scroll-chips flex-1 min-w-0">
                {QUICK_COMMANDS.map((cmd) => (
                  <button
                    key={cmd}
                    type="button"
                    onClick={() => executeCommand(cmd)}
                    className={`px-2.5 py-1 rounded-md border text-[11px] font-mono whitespace-nowrap shrink-0 transition-colors ${
                      isLight
                        ? 'border-slate-200 bg-white hover:border-sky-400 hover:bg-sky-50 text-sky-700'
                        : 'border-slate-800 bg-[#0d1424] hover:border-cyan-500/40 text-cyan-300'
                    }`}
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>

            {/* Output Stream */}
            <div
              ref={scrollRef}
              onClick={() => inputRef.current?.focus()}
              className={`flex-1 min-h-[160px] overflow-y-auto overscroll-contain p-4 font-mono text-xs leading-relaxed space-y-3 ${
                isLight ? 'bg-[#f8fafc]' : 'bg-[#070b14]'
              }`}
            >
              {entries.map((entry) => (
                <div key={entry.id} className="space-y-1">
                  {entry.command && (
                    <div className={isLight ? 'text-slate-600' : 'text-slate-400'}>
                      <span className={isLight ? 'text-emerald-700 font-medium' : 'text-emerald-400'}>
                        visitor@mohammedsufyan.com
                      </span>
                      <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>:~$ </span>
                      <span className={isLight ? 'text-slate-900 font-semibold' : 'text-white'}>
                        {entry.command}
                      </span>
                    </div>
                  )}
                  <div
                    className={`space-y-0.5 whitespace-pre-wrap break-words ${
                      entry.tone === 'error'
                        ? isLight
                          ? 'text-rose-600'
                          : 'text-rose-300'
                        : entry.tone === 'accent'
                          ? isLight
                            ? 'text-sky-700'
                            : 'text-cyan-300'
                          : isLight
                            ? 'text-slate-700'
                            : 'text-slate-300'
                    }`}
                  >
                    {entry.lines.map((line, i) => (
                      <div key={i}>{line || '\u00A0'}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Prompt Input */}
            <form
              onSubmit={handleSubmit}
              className={`shrink-0 flex items-center gap-2 px-4 py-3 border-t font-mono text-xs ${
                isLight
                  ? 'border-slate-200 bg-white'
                  : 'border-slate-800 bg-[#090d16]'
              }`}
            >
              <span className={`shrink-0 ${isLight ? 'text-emerald-700 font-semibold' : 'text-emerald-400'}`}>
                $
              </span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const nextIdx = Math.min(history.length - 1, historyIndex + 1);
                    if (history[nextIdx] !== undefined) {
                      setHistoryIndex(nextIdx);
                      setInput(history[nextIdx]);
                    }
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const nextIdx = historyIndex - 1;
                    if (nextIdx < 0) {
                      setHistoryIndex(-1);
                      setInput('');
                    } else if (history[nextIdx] !== undefined) {
                      setHistoryIndex(nextIdx);
                      setInput(history[nextIdx]);
                    }
                  }
                }}
                placeholder='Type a command (e.g. "help", "ls certs --cloud=aws", "whoami")'
                aria-label="Terminal command input"
                className={`flex-1 bg-transparent focus:outline-none ${
                  isLight
                    ? 'text-slate-900 placeholder-slate-400'
                    : 'text-white placeholder-slate-500'
                }`}
              />
              <button
                type="submit"
                className={`px-3 py-1 rounded-md font-semibold text-[11px] transition-colors shrink-0 ${
                  isLight
                    ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                }`}
              >
                Run
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
