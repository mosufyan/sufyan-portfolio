/** Canonical brand mark asset — hexagon + geometric MS (concept B, S inset). */
export const BRAND_MARK_SRC = '/icon.svg';

/** Raster tile used in UI — regenerated from icon.svg. */
export const BRAND_MARK_PNG_SRC = '/pwa-192x192.png';

export const BRAND_MARK_HEX_PATH =
  'M256 78 L404 163.5 L404 348.5 L256 434 L108 348.5 L108 163.5 Z';

/** Geometric MS — concept B letterforms. */
export const BRAND_MARK_MS_PATH = `M150 338V174h32l52 96 52-96h32v164h-34V232l-40 74h-20l-40-74v106h-34zm196-158
      c0-28 22-44 58-44h52v34h-46c-16 0-26 6-26 20s10 20 30 26l36 10
      c38 12 56 34 56 68 0 44-34 70-86 70h-74v-34h78c24 0 40-12 40-32
      0-18-12-28-34-34l-38-12c-36-12-46-32-46-56z`;

/** Keep S inside the hex at favicon / 16–32px sizes. */
export const BRAND_MARK_MS_TRANSFORM =
  'translate(256 256) scale(0.58) translate(-286 -256)';

export const BRAND_ACCENT_HEX = {
  cyan: '#22d3ee',
  amber: '#fbbf24',
} as const;

export type BrandAccent = keyof typeof BRAND_ACCENT_HEX;

/**
 * Brand mark SVG with optional accent recolor.
 * Same geometry as public/icon.svg (MS inset inside hex).
 */
export function buildBrandMarkSvg(options?: {
  accent?: string;
  background?: string;
}): string {
  const accent = options?.accent ?? BRAND_ACCENT_HEX.cyan;
  const background = options?.background ?? '#06080d';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Mohammed Sufyan">
  <rect width="512" height="512" fill="${background}"/>
  <path fill="none" stroke="${accent}" stroke-width="26" stroke-linejoin="round" d="${BRAND_MARK_HEX_PATH}"/>
  <g transform="${BRAND_MARK_MS_TRANSFORM}">
    <path fill="${accent}" d="${BRAND_MARK_MS_PATH}"/>
  </g>
</svg>`;
}

export function brandMarkSvgSnippet(
  x: number,
  y: number,
  size: number,
  accent: string = BRAND_ACCENT_HEX.cyan
): string {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 512 512" role="img" aria-label="Mohammed Sufyan">
  <rect width="512" height="512" fill="#06080d"/>
  <path fill="none" stroke="${accent}" stroke-width="26" stroke-linejoin="round" d="${BRAND_MARK_HEX_PATH}"/>
  <g transform="${BRAND_MARK_MS_TRANSFORM}">
    <path fill="${accent}" d="${BRAND_MARK_MS_PATH}"/>
  </g>
</svg>`;
}

export function brandMarkDataUrl(accent: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildBrandMarkSvg({ accent }))}`;
}
