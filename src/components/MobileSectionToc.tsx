import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useTheme } from '../theme/ThemeProvider';
import { EASE_OUT_EXPO } from './MotionPrimitives';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'philosophy', label: 'Philosophy' },
  { id: 'experience', label: 'Experience' },
  { id: 'skills', label: 'Skills' },
  { id: 'certifications', label: 'Certs' },
  { id: 'honors', label: 'Honors' },
  { id: 'education', label: 'Education' },
  { id: 'contact', label: 'Contact' },
] as const;

/** Compact horizontal section TOC for small screens while scrolling. */
export default function MobileSectionToc() {
  const { isLight } = useTheme();
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState<(typeof SECTIONS)[number]['id']>('overview');

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 280);
      const offset = window.scrollY + 140;
      let current: (typeof SECTIONS)[number]['id'] = SECTIONS[0].id;
      for (const section of SECTIONS) {
        const el = document.getElementById(section.id);
        if (el && el.offsetTop <= offset) current = section.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
          aria-label="Section shortcuts"
          className={`md:hidden fixed top-14 sm:top-16 inset-x-0 z-30 border-b backdrop-blur-md print:hidden ${
            isLight
              ? 'border-slate-200 bg-white/90'
              : 'border-slate-800/80 bg-[#07090e]/92'
          }`}
        >
          <div className="page-shell overflow-x-auto scrollbar-none py-2">
            <div className="flex items-center gap-1.5 min-w-max">
              {SECTIONS.map((section) => {
                const isActive = active === section.id;
                return (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                      isActive
                        ? isLight
                          ? 'bg-sky-100 text-sky-800 border border-sky-300'
                          : 'bg-cyan-950/60 text-cyan-200 border border-cyan-500/40'
                        : isLight
                          ? 'text-slate-600 border border-transparent hover:bg-slate-100'
                          : 'text-slate-400 border border-transparent hover:text-slate-200 hover:bg-slate-900/70'
                    }`}
                  >
                    {section.label}
                  </a>
                );
              })}
            </div>
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
