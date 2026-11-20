import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ChevronUp, Compass, Search, WifiOff, Zap, Layers } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTheme } from '../theme/ThemeProvider';
import { EASE_OUT_EXPO } from './MotionPrimitives';

export type PortfolioReadingMode = 'deep' | 'brief';

const HUD_SECTIONS = [
  { id: 'overview', index: '01', label: 'Overview' },
  { id: 'philosophy', index: '02', label: 'Philosophy' },
  { id: 'experience', index: '03', label: 'Experience' },
  { id: 'skills', index: '04', label: 'Skills' },
  { id: 'certifications', index: '05', label: 'Certifications' },
  { id: 'honors', index: '06', label: 'Honors' },
  { id: 'education', index: '07', label: 'Education' },
  { id: 'contact', index: '08', label: 'Contact' },
] as const;

interface UnifiedScrollHudProps {
  readingMode: PortfolioReadingMode;
  onChangeReadingMode: (mode: PortfolioReadingMode) => void;
  onOpenCommandPalette: () => void;
}

/**
 * Single low-profile floating HUD replacing separate mobile TOC bar, back-to-top FAB,
 * and offline banner so mobile & desktop viewports stay uncluttered (<15% sticky budget).
 */
export default function UnifiedScrollHud({
  readingMode,
  onChangeReadingMode,
  onOpenCommandPalette,
}: UnifiedScrollHudProps) {
  const { isLight } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<(typeof HUD_SECTIONS)[number]['id']>('overview');
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const hudRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 280);
      const scrollBottom = window.innerHeight + window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      if (docHeight - scrollBottom < 60) {
        setActiveId('contact');
        return;
      }
      const offset = window.scrollY + 150;
      let current: (typeof HUD_SECTIONS)[number]['id'] = HUD_SECTIONS[0].id;
      for (const sec of HUD_SECTIONS) {
        const el = document.getElementById(sec.id);
        if (el && el.offsetTop <= offset) current = sec.id;
      }
      setActiveId(current);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (hudRef.current && !hudRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const activeSec = HUD_SECTIONS.find((s) => s.id === activeId) ?? HUD_SECTIONS[0];

  const shellCls = isLight
    ? 'border-slate-200/90 bg-white/95 text-slate-800 shadow-[0_10px_30px_rgba(15,23,42,0.12)]'
    : 'border-slate-700/80 bg-[#0b101d]/92 text-slate-200 shadow-[0_12px_36px_rgba(0,0,0,0.55)]';

  const dividerCls = isLight ? 'bg-slate-200' : 'bg-slate-800';

  const scrollToTop = () => {
    setMenuOpen(false);
    if (window.location.hash) {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const jumpToSection = (id: string) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <AnimatePresence>
      {(visible || !isOnline) && (
        <motion.div
          ref={hudRef}
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.96 }}
          transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 max-w-[calc(100vw-1.5rem)] print:hidden"
        >
          {/* Compact upward section popover */}
          <AnimatePresence>
            {menuOpen && (
              <motion.nav
                aria-label="Quick section jump"
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.16, ease: EASE_OUT_EXPO }}
                className={`w-64 sm:w-72 rounded-2xl border p-2 backdrop-blur-xl ${shellCls}`}
              >
                <div
                  className={`px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider ${
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  Jump to section
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {HUD_SECTIONS.map((sec) => {
                    const isActive = sec.id === activeId;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => jumpToSection(sec.id)}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-xs font-mono transition-colors ${
                          isActive
                            ? isLight
                              ? 'bg-sky-50 text-sky-800 border border-sky-200 font-semibold'
                              : 'bg-cyan-950/70 text-cyan-200 border border-cyan-500/40 font-semibold'
                            : isLight
                              ? 'text-slate-700 hover:bg-slate-100 border border-transparent'
                              : 'text-slate-300 hover:bg-slate-800/70 border border-transparent'
                        }`}
                      >
                        <span className={isLight ? 'text-sky-600 text-[10px]' : 'text-cyan-400 text-[10px]'}>
                          {sec.index}
                        </span>
                        <span className="truncate">{sec.label}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.nav>
            )}
          </AnimatePresence>

          {/* Single Unified HUD Dock */}
          <div
            className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-2xl border px-1.5 py-1.5 backdrop-blur-xl ${shellCls}`}
          >
            {!isOnline && (
              <>
                <span
                  role="status"
                  aria-live="polite"
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-amber-500/15 text-amber-400 text-[11px] font-mono whitespace-nowrap shrink-0"
                  title="Offline Mode — Viewing cached portfolio"
                >
                  <WifiOff className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Offline</span>
                </span>
                <span className={`h-4 w-px ${dividerCls}`} aria-hidden="true" />
              </>
            )}

            {/* Section Selector Button */}
            {visible && (
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-expanded={menuOpen}
                aria-label="Open section navigation"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                  menuOpen
                    ? isLight
                      ? 'bg-sky-50 text-sky-800'
                      : 'bg-cyan-950/60 text-cyan-200'
                    : isLight
                      ? 'hover:bg-slate-100 text-slate-700'
                      : 'hover:bg-slate-800/80 text-slate-200'
                }`}
              >
                <Compass className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-sky-600' : 'text-cyan-400'}`} />
                <span className={`text-[10px] ${isLight ? 'text-sky-600' : 'text-cyan-400'}`}>
                  {activeSec.index}
                </span>
                <span className="font-medium max-w-[6.5rem] sm:max-w-none truncate">
                  {activeSec.label}
                </span>
                <ChevronUp
                  className={`w-3 h-3 transition-transform duration-150 ${
                    menuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            )}

            <span className={`h-4 w-px ${dividerCls}`} aria-hidden="true" />

            {/* Recruiter 30s Brief / Technical Deep-Dive Switcher */}
            <button
              type="button"
              onClick={() =>
                onChangeReadingMode(readingMode === 'brief' ? 'deep' : 'brief')
              }
              aria-pressed={readingMode === 'brief'}
              title={
                readingMode === 'brief'
                  ? '30-Second Executive Brief active — click for Full Technical Deep-Dive'
                  : 'Switch to 30-Second Executive Brief mode'
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono transition-colors whitespace-nowrap shrink-0 ${
                readingMode === 'brief'
                  ? isLight
                    ? 'bg-sky-600 text-white font-semibold'
                    : 'bg-cyan-500 text-slate-950 font-semibold'
                  : isLight
                    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-cyan-300'
              }`}
            >
              {readingMode === 'brief' ? (
                <>
                  <Zap className="w-3 h-3 shrink-0" />
                  <span>30s Brief</span>
                </>
              ) : (
                <>
                  <Layers className="w-3 h-3 shrink-0" />
                  <span className="hidden sm:inline">Deep-Dive</span>
                  <span className="sm:hidden">Full</span>
                </>
              )}
            </button>

            <span className={`h-4 w-px ${dividerCls}`} aria-hidden="true" />

            {/* Quick Palette Trigger */}
            <button
              type="button"
              onClick={onOpenCommandPalette}
              aria-label="Quick navigation & search (⌘K)"
              title="Search & Quick Jump (⌘K)"
              className={`inline-flex items-center justify-center p-1.5 sm:px-2 sm:py-1.5 rounded-xl text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                isLight
                  ? 'text-slate-600 hover:bg-slate-100 hover:text-sky-700'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-cyan-300'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Integrated Back-to-Top */}
            {visible && (
              <button
                type="button"
                onClick={scrollToTop}
                aria-label="Back to top"
                title="Back to top"
                className={`inline-flex items-center justify-center p-1.5 rounded-xl transition-colors shrink-0 ${
                  isLight
                    ? 'bg-slate-100 text-sky-700 hover:bg-sky-100'
                    : 'bg-slate-800/90 text-cyan-300 hover:bg-cyan-950/80 hover:text-white'
                }`}
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
