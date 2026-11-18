import { useEffect, useState } from 'react';
import { useTheme } from '../theme/ThemeProvider';

const RAIL_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'philosophy', label: 'Philosophy' },
  { id: 'experience', label: 'Experience' },
  { id: 'skills', label: 'Skills' },
  { id: 'certifications', label: 'Certifications' },
  { id: 'honors', label: 'Honors' },
  { id: 'education', label: 'Education' },
  { id: 'contact', label: 'Contact' },
] as const;

/** Unobtrusive right-edge interactive section rail on wide desktop viewports. */
export default function DesktopScrollRail() {
  const { isLight } = useTheme();
  const [activeId, setActiveId] = useState<string>('overview');

  useEffect(() => {
    const updateActive = () => {
      const scrollBottom = window.innerHeight + window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      if (docHeight - scrollBottom < 60) {
        setActiveId('contact');
        return;
      }
      const offset = window.scrollY + 180;
      let current: string = RAIL_SECTIONS[0].id;
      for (const sec of RAIL_SECTIONS) {
        const el = document.getElementById(sec.id);
        if (el && el.offsetTop <= offset) {
          current = sec.id;
        }
      }
      setActiveId(current);
    };

    updateActive();
    window.addEventListener('scroll', updateActive, { passive: true });
    return () => window.removeEventListener('scroll', updateActive);
  }, []);

  return (
    <nav
      aria-label="Section scroll rail"
      className="hidden 2xl:flex fixed right-4 top-1/2 -translate-y-1/2 z-30 flex-col items-end gap-2 print:hidden"
    >
      {RAIL_SECTIONS.map((sec) => {
        const isActive = activeId === sec.id;
        return (
          <a
            key={sec.id}
            href={`#${sec.id}`}
            aria-label={`Jump to ${sec.label}`}
            className="group flex items-center gap-2 py-0.5 focus:outline-none"
          >
            <span
              className={`text-[10px] font-mono transition-all duration-150 ${
                isActive
                  ? isLight
                    ? 'opacity-100 text-sky-700 font-semibold translate-x-0'
                    : 'opacity-100 text-cyan-300 font-semibold translate-x-0'
                  : isLight
                    ? 'opacity-0 group-hover:opacity-100 text-slate-600 translate-x-1 group-hover:translate-x-0'
                    : 'opacity-0 group-hover:opacity-100 text-slate-400 translate-x-1 group-hover:translate-x-0'
              }`}
            >
              {sec.label}
            </span>
            <span
              aria-hidden="true"
              className={`block rounded-full transition-all duration-150 ${
                isActive
                  ? isLight
                    ? 'w-5 h-1.5 bg-sky-600'
                    : 'w-5 h-1.5 bg-cyan-400'
                  : isLight
                    ? 'w-2.5 h-1.5 bg-slate-300 group-hover:w-4 group-hover:bg-sky-500'
                    : 'w-2.5 h-1.5 bg-slate-700 group-hover:w-4 group-hover:bg-cyan-400/70'
              }`}
            />
          </a>
        );
      })}
    </nav>
  );
}
