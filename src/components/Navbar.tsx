import { type MouseEvent as ReactMouseEvent, useEffect, useState } from 'react';
import { Download, Menu, X, Mail, Search, Terminal } from 'lucide-react';
import {
  AnimatePresence,
  MotionValue,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { useTheme } from '../theme/ThemeProvider';
import { EASE_OUT_EXPO } from './MotionPrimitives';
import ThemeSymbol from './ThemeSymbol';

const CONSTELLATION_DOTS = 14;

function ConstellationDot({
  progress,
  threshold,
}: {
  progress: MotionValue<number>;
  threshold: number;
}) {
  const opacity = useTransform(
    progress,
    [Math.max(0, threshold - 0.04), threshold, Math.min(1, threshold + 0.12)],
    [0.12, 1, 0.28]
  );
  const scale = useTransform(
    progress,
    [Math.max(0, threshold - 0.04), threshold, Math.min(1, threshold + 0.14)],
    [0.55, 1.45, 0.8]
  );

  return (
    <motion.span
      aria-hidden="true"
      style={{ left: `${threshold * 100}%`, opacity, scale }}
      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.85)]"
    />
  );
}

interface NavbarProps {
  onOpenResume: () => void;
  onOpenAnnouncements: () => void;
  onOpenCommandPalette: () => void;
  onOpenTerminal: () => void;
}

const NAV_LINKS = [
  { id: 'overview', label: 'Overview', href: '#overview' },
  { id: 'philosophy', label: 'Philosophy', href: '#philosophy' },
  { id: 'experience', label: 'Experience', href: '#experience' },
  { id: 'skills', label: 'Skills', href: '#skills' },
  { id: 'certifications', label: 'Certifications', href: '#certifications' },
  { id: 'honors', label: 'Honors', href: '#honors' },
  { id: 'education', label: 'Education', href: '#education' },
  { id: 'contact', label: 'Contact', href: '#contact' },
] as const;

export default function Navbar({
  onOpenResume,
  onOpenAnnouncements,
  onOpenCommandPalette,
  onOpenTerminal,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [themeWash, setThemeWash] = useState<'light' | 'dark' | null>(null);
  const { isLight, toggleTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 32,
    restDelta: 0.001,
  });

  const handleThemeToggle = () => {
    const next = isLight ? 'dark' : 'light';
    if (!shouldReduceMotion) {
      setThemeWash(next);
      window.setTimeout(() => setThemeWash(null), 520);
    }
    toggleTheme();
  };

  const scrollToSection = (
    e: ReactMouseEvent<HTMLAnchorElement>,
    sectionId: string,
    closeDrawer = false
  ) => {
    e.preventDefault();
    if (closeDrawer) {
      setMobileMenuOpen(false);
    }

    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    try {
      const nextHash = `#${sectionId}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}${nextHash}`);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const sections = NAV_LINKS.map((link) => document.getElementById(link.id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (sections.length === 0) return;

    const updateActiveOnScroll = () => {
      const scrollBottom = window.innerHeight + window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      if (docHeight - scrollBottom < 60) {
        setActiveSection('contact');
        return;
      }

      const offset = window.scrollY + 130;
      let current = sections[0].id;
      for (const sec of sections) {
        if (sec.offsetTop <= offset) {
          current = sec.id;
        }
      }
      setActiveSection(current);
    };

    updateActiveOnScroll();
    window.addEventListener('scroll', updateActiveOnScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateActiveOnScroll);
  }, []);

  // Close drawer when resizing up to desktop nav
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const onChange = () => {
      if (mq.matches) setMobileMenuOpen(false);
    };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <header className="navbar-chrome sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#07090e]/90 backdrop-blur-md transition-all print:hidden">
      <div className="page-shell flex items-center gap-3 sm:gap-4 xl:gap-6 h-14 sm:h-16 min-w-0">
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            setMobileMenuOpen(false);
            if (window.location.hash) {
              window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="group flex items-center shrink-0 text-slate-100 focus:outline-none"
          aria-label="Scroll to top"
          title="Back to top"
        >
          <motion.div
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/30 text-cyan-400 font-bold font-display text-sm tracking-wider shadow-sm shadow-cyan-500/10 group-hover:border-cyan-400/60 group-hover:shadow-cyan-500/25 transition-colors"
          >
            MS
          </motion.div>
        </a>

        {/* Full desktop nav — xl+ only to avoid crush on tablets / small laptops */}
        <nav className="hidden xl:flex flex-1 items-center justify-center gap-5 2xl:gap-6 min-w-0 text-sm font-medium text-slate-400 px-2">
          {NAV_LINKS.map((link) => {
            const isActive = activeSection === link.id;
            return (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => scrollToSection(e, link.id)}
                className={`relative whitespace-nowrap py-1.5 transition-colors ${
                  isActive ? 'text-cyan-300' : 'hover:text-cyan-400'
                }`}
              >
                {link.label}
                {isActive && (
                  <motion.span
                    layoutId="navbar-active-underline"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-cyan-400 to-sky-400 shadow-[0_0_10px_rgba(34,211,238,0.7)]"
                  >
                    <span className="absolute inset-0 rounded-full bg-cyan-300/40 blur-[3px]" />
                  </motion.span>
                )}
              </a>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0 xl:pl-3 xl:border-l xl:border-slate-800/70">
          <button
            type="button"
            onClick={handleThemeToggle}
            className={`hidden sm:inline-flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap overflow-hidden ${
              isLight
                ? 'border-amber-400/70 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'border-slate-700/90 bg-slate-900/70 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40'
            }`}
            title={isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
            aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            <ThemeSymbol
              isLight={isLight}
              boxClassName="h-3.5 w-3.5"
              iconClassName="w-3.5 h-3.5"
              sunColorClass="text-amber-600"
              moonColorClass="text-cyan-400"
              keyPrefix="nav-desktop"
            />
            <span className="hidden 2xl:inline">{isLight ? 'Light' : 'Dark'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="hidden sm:inline-flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-lg border border-slate-700/90 bg-slate-900/70 text-xs font-mono text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors whitespace-nowrap"
            title="Quick Jump & Search (⌘K / Ctrl+K)"
            aria-label="Open quick navigation palette"
          >
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden 2xl:inline text-[11px] text-slate-400">⌘K</span>
          </button>

          <button
            type="button"
            onClick={onOpenTerminal}
            className="hidden sm:inline-flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-lg border border-slate-700/90 bg-slate-900/70 text-xs font-mono text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors whitespace-nowrap"
            title="Open Interactive Terminal (sufyanctl)"
            aria-label="Open interactive portfolio terminal"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden 2xl:inline text-[11px] text-slate-400">CLI</span>
          </button>

          <button
            type="button"
            onClick={onOpenAnnouncements}
            className="hidden md:inline-flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-lg border border-slate-700 bg-slate-900/60 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-600 transition-colors whitespace-nowrap"
            title="View Announcements"
          >
            <span className="hidden xl:inline">Announcements</span>
            <span className="xl:hidden">News</span>
          </button>

          <button
            type="button"
            onClick={onOpenResume}
            className="hidden sm:inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-cyan-500/40 bg-cyan-950/30 hover:bg-cyan-900/50 text-xs font-semibold text-cyan-300 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Download CV</span>
            <span className="md:hidden">CV</span>
          </button>

          <a
            href="#contact"
            onClick={(e) => scrollToSection(e, 'contact')}
            className="hidden sm:inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-xs font-semibold text-slate-950 transition-colors whitespace-nowrap"
          >
            <Mail className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Get in Touch</span>
            <span className="xl:hidden">Contact</span>
          </a>

          {/* Phone / tablet / laptop-below-xl controls */}
          <div className="flex xl:hidden items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleThemeToggle}
              className={`sm:hidden inline-flex items-center justify-center h-9 w-9 rounded-lg border transition-colors overflow-hidden ${
                isLight
                  ? 'border-amber-400/70 bg-amber-50 text-amber-700'
                  : 'border-slate-700/90 bg-slate-900/70 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40'
              }`}
              aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
            >
              <ThemeSymbol
                isLight={isLight}
                boxClassName="h-4 w-4"
                iconClassName="w-4 h-4"
                sunColorClass="text-amber-600"
                moonColorClass="text-cyan-400"
                keyPrefix="nav-mobile"
              />
            </button>
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="sm:hidden inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-700/90 bg-slate-900/70 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors"
              aria-label="Open quick search"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenResume}
              className="sm:hidden inline-flex items-center justify-center h-9 px-3 rounded-lg border border-cyan-500/40 text-xs font-semibold text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/50 transition-colors"
            >
              CV
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors focus:outline-none"
              aria-label="Toggle Navigation Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
            className="xl:hidden absolute top-full inset-x-0 z-50 overflow-hidden border-b border-slate-800 bg-[#07090e]/95 backdrop-blur-md shadow-2xl"
          >
            <div className="page-shell pt-2 pb-4 space-y-2 max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 py-2">
                {NAV_LINKS.map((link) => {
                  const isActive = activeSection === link.id;
                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      onClick={(e) => scrollToSection(e, link.id, true)}
                      className={`px-3 py-2.5 text-xs font-medium rounded-md transition-colors ${
                        isActive
                          ? 'text-cyan-300 bg-cyan-950/40 border border-cyan-500/30'
                          : 'text-slate-300 hover:bg-slate-800/80 border border-transparent'
                      }`}
                    >
                      {link.label}
                    </a>
                  );
                })}
              </div>
              <div className="sm:hidden pt-2 border-t border-slate-800 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenTerminal();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border border-slate-700 bg-slate-900/60 text-xs font-mono text-cyan-300"
                >
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  Terminal (sufyanctl)
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAnnouncements();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border border-slate-700 bg-slate-900/60 text-xs font-medium text-slate-300"
                >
                  Announcements
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenResume();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-cyan-950/50 border border-cyan-500/40 text-xs font-semibold text-cyan-300"
                >
                  <Download className="w-4 h-4" /> Download Executive CV
                </button>
                <a
                  href="#contact"
                  onClick={(e) => scrollToSection(e, 'contact', true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-cyan-500 text-xs font-semibold text-slate-950"
                >
                  <Mail className="w-4 h-4" /> Contact Mohammed
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll progress + constellation dots */}
      <div className="relative h-[3px] w-full bg-slate-800/40 overflow-visible">
        <motion.div
          style={{ scaleX }}
          className="absolute inset-y-0 left-0 w-full origin-left bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500"
        />
        {!shouldReduceMotion && (
          <div className="pointer-events-none absolute inset-0">
            {Array.from({ length: CONSTELLATION_DOTS }, (_, i) => {
              const threshold = i / (CONSTELLATION_DOTS - 1);
              return (
                <ConstellationDot
                  key={i}
                  progress={scrollYProgress}
                  threshold={threshold}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Theme toggle ambient wash */}
      <AnimatePresence>
        {themeWash && (
          <motion.div
            key={themeWash}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
            className="pointer-events-none fixed inset-0 z-[45]"
            style={{
              background:
                themeWash === 'light'
                  ? 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(251,191,36,0.28), transparent 70%)'
                  : 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(34,211,238,0.22), transparent 70%)',
            }}
          />
        )}
      </AnimatePresence>
    </header>
  );
}
