import { useMemo } from 'react';

/** Compact reactive bars for the shared voice stage (PTT + live S2S). */
export default function VoiceWaveform({
  level,
  active,
  isLight,
  barCount = 22,
  className = '',
}: {
  level: number;
  active: boolean;
  isLight: boolean;
  barCount?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(1, level));
  const heights = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < barCount; i++) {
      const wave = Math.sin(i * 0.62 + clamped * 9.4) * 0.5 + 0.5;
      const mid = 1 - Math.abs(i - (barCount - 1) / 2) / ((barCount - 1) / 2);
      if (!active) {
        out.push(0.1 + (i % 4) * 0.03);
        continue;
      }
      out.push(Math.max(0.12, Math.min(1, clamped * 0.55 + wave * clamped * 0.55 + mid * 0.12)));
    }
    return out;
  }, [barCount, clamped, active]);

  const barCls = isLight
    ? active
      ? 'bg-amber-500'
      : 'bg-amber-300/50'
    : active
      ? 'bg-cyan-400'
      : 'bg-cyan-700/50';

  return (
    <div
      className={`flex h-12 sm:h-14 w-full max-w-xs mx-auto items-end justify-center gap-[3px] px-2 ${className}`}
      aria-hidden
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] sm:w-1 rounded-full transition-[height,opacity] duration-75 ${barCls}`}
          style={{
            height: `${Math.round(h * 100)}%`,
            opacity: active ? 0.55 + h * 0.45 : 0.35,
          }}
        />
      ))}
    </div>
  );
}
