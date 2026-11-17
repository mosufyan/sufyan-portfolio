import { useEffect, useState } from 'react';
import { Download, Menu, X, Mail, Search, Sun, Moon } from 'lucide-react';
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import { useTheme } from '../theme/ThemeProvider';
import { EASE_OUT_EXPO } from './MotionPrimitives';

interface NavbarProps {
  onOpenResume: () => void;
  onOpenAnnouncements: () => void;
  onOpenCommandPalette: () => void;
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

export default function Navbar({ onOpenResume, onOpenAnnouncements, onOpenCommandPalette }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('overview');
  const { isLight, toggleTheme } = useTheme();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 32,
    restDelta: 0.001,
  });

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
          className="group flex items-center shrink-0 text-slate-100 focus:outline-none"
          aria-label="Home"
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
                className={`relative whitespace-nowrap py-1.5 transition-colors ${
                  isActive ? 'text-cyan-300' : 'hover:text-cyan-400'
                }`}
              >
                {link.label}
                {isActive && (
                  <motion.span
                    layoutId="navbar-active-underline"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-cyan-400 to-sky-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                  />
                )}
              </a>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0 pl-2 sm:pl-3 border-l border-slate-800/70">
          <button
            type="button"
            onClick={toggleTheme}
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
              isLight
                ? 'border-amber-400/70 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'border-slate-700/90 bg-slate-900/70 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40'
            }`}
            title={isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
            aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {isLight ? (
              <Sun className="w-3.5 h-3.5 text-amber-600" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span className="hidden 2xl:inline">{isLight ? 'Light' : 'Dark'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700/90 bg-slate-900/70 text-xs font-mono text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors whitespace-nowrap"
            title="Quick Jump & Search (⌘K / Ctrl+K)"
            aria-label="Open quick navigation palette"
          >
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden 2xl:inline text-[11px] text-slate-400">⌘K</span>
          </button>

          <button
            onClick={onOpenAnnouncements}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900/60 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-600 transition-colors whitespace-nowrap"
            title="View Announcements"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="hidden xl:inline">Announcements</span>
            <span className="xl:hidden">News</span>
          </button>

          <button
            onClick={onOpenResume}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/30 hover:bg-cyan-900/50 text-xs font-semibold text-cyan-300 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Download CV</span>
            <span className="md:hidden">CV</span>
          </button>

          <a
            href="#contact"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-xs font-semibold text-slate-950 transition-colors whitespace-nowrap"
          >
            <Mail className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Get in Touch</span>
            <span className="xl:hidden">Contact</span>
          </a>

          {/* Phone / tablet / laptop-below-xl controls */}
          <div className="flex xl:hidden items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className={`sm:hidden p-1.5 rounded-md border transition-colors ${
                isLight
                  ? 'border-amber-400/70 bg-amber-50 text-amber-700'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:text-cyan-300'
              }`}
              aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
            >
              {isLight ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="sm:hidden p-1.5 rounded-md border border-slate-700 bg-slate-900/70 text-slate-300 hover:text-cyan-300"
              aria-label="Open quick search"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenResume}
              className="sm:hidden px-2.5 py-1.5 rounded-md border border-cyan-500/40 text-[11px] font-semibold text-cyan-300 bg-cyan-950/40"
            >
              CV
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
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
            className="xl:hidden overflow-hidden border-b border-slate-800 bg-[#07090e]/95"
          >
            <div className="page-shell pt-2 pb-4 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 py-2">
                {NAV_LINKS.map((link) => {
                  const isActive = activeSection === link.id;
                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
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
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAnnouncements();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border border-slate-700 bg-slate-900/60 text-xs font-medium text-slate-300"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
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
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-cyan-500 text-xs font-semibold text-slate-950"
                >
                  <Mail className="w-4 h-4" /> Contact Mohammed
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        style={{ scaleX }}
        className="h-[2px] w-full origin-left bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500"
      />
    </header>
  );
}
