import { useEffect, useId, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import {
  SITE_ACCENT_LABELS,
  SITE_ACCENTS,
  SITE_THEME_LABELS,
  SITE_THEMES,
  useTheme,
  type SiteAccent,
  type SiteTheme,
} from '../theme/ThemeProvider';
import ThemeSymbol from './ThemeSymbol';

interface ThemeAppearanceMenuProps {
  /** Compact icon-only trigger (mobile). */
  compact?: boolean;
  className?: string;
  onThemeModeChange?: (next: SiteTheme) => void;
}

const ACCENT_SWATCH: Record<SiteAccent, string> = {
  cyan: 'bg-cyan-400',
  amber: 'bg-amber-400',
};

export default function ThemeAppearanceMenu({
  compact = false,
  className = '',
  onThemeModeChange,
}: ThemeAppearanceMenuProps) {
  const { theme, accent, isLight, setTheme, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const applyTheme = (next: SiteTheme) => {
    if (next !== theme) {
      onThemeModeChange?.(next);
      setTheme(next);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((prev) => !prev)}
        className={
          compact
            ? `sm:hidden inline-flex items-center justify-center h-9 w-9 rounded-lg border transition-colors overflow-hidden ${
                isLight
                  ? 'border-amber-400/70 bg-amber-50 text-amber-700'
                  : 'border-slate-700/90 bg-slate-900/70 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40'
              }`
            : `hidden sm:inline-flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 overflow-hidden ${
                isLight
                  ? 'border-amber-400/70 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-slate-700/90 bg-slate-900/70 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40'
              }`
        }
        title="Appearance"
        aria-label={`Appearance menu, ${SITE_THEME_LABELS[theme]} theme, ${SITE_ACCENT_LABELS[accent]} accent`}
      >
        {compact ? (
          <Palette className="w-4 h-4" />
        ) : (
          <>
            <ThemeSymbol
              isLight={isLight}
              boxClassName="h-3.5 w-3.5"
              iconClassName="w-3.5 h-3.5"
              sunColorClass="text-amber-600"
              moonColorClass="text-cyan-400"
              keyPrefix="nav-appearance"
            />
            <span className="hidden 2xl:inline">{SITE_THEME_LABELS[theme]}</span>
            <span
              className={`h-2 w-2 rounded-full ${ACCENT_SWATCH[accent]}`}
              aria-hidden="true"
            />
          </>
        )}
      </button>

      {open && (
        <div
          id={menuId}
          role="dialog"
          aria-label="Appearance"
          className={`absolute right-0 top-[calc(100%+0.4rem)] z-[70] w-56 rounded-xl border p-2.5 shadow-xl ${
            isLight
              ? 'border-slate-200 bg-white text-slate-900 shadow-slate-900/10'
              : 'border-slate-700 bg-[#0b101b] text-slate-100 shadow-black/50'
          }`}
        >
          <div
            className={`px-1.5 pb-1.5 text-[10px] font-mono uppercase tracking-wider ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            Mode
          </div>
          <div className="grid grid-cols-2 gap-1.5 mb-2.5">
            {SITE_THEMES.map((mode) => {
              const active = theme === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => applyTheme(mode)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? isLight
                        ? 'border-sky-400 bg-sky-50 text-sky-900'
                        : 'border-cyan-400/70 bg-cyan-950/40 text-cyan-200'
                      : isLight
                        ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <ThemeSymbol
                    isLight={mode === 'light'}
                    boxClassName="h-3.5 w-3.5"
                    iconClassName="w-3.5 h-3.5"
                    sunColorClass="text-amber-600"
                    moonColorClass="text-cyan-400"
                    keyPrefix={`mode-${mode}`}
                  />
                  {SITE_THEME_LABELS[mode]}
                  {active && <Check className="w-3 h-3 opacity-80" />}
                </button>
              );
            })}
          </div>

          <div
            className={`px-1.5 pb-1.5 text-[10px] font-mono uppercase tracking-wider ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            Accent
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {SITE_ACCENTS.map((pack) => {
              const active = accent === pack;
              return (
                <button
                  key={pack}
                  type="button"
                  onClick={() => setAccent(pack)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? isLight
                        ? 'border-sky-400 bg-sky-50 text-sky-900'
                        : 'border-cyan-400/70 bg-cyan-950/40 text-cyan-200'
                      : isLight
                        ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${ACCENT_SWATCH[pack]}`} />
                  {SITE_ACCENT_LABELS[pack]}
                  {active && <Check className="w-3 h-3 opacity-80" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
