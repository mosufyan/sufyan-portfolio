/** Canonical brand mark asset (cyan hexagon + MS on dark tile). */
export const BRAND_MARK_SRC = '/icon.svg';

/**
 * Inline SVG body (viewBox 0 0 512 512) for places that cannot load /icon.svg,
 * e.g. dynamically generated OG cards.
 */
export const BRAND_MARK_SVG_INNER = `
  <rect width="512" height="512" fill="#06080d"/>
  <path
    fill="none"
    stroke="#22d3ee"
    stroke-width="26"
    stroke-linejoin="round"
    d="M256 78 L404 163.5 L404 348.5 L256 434 L108 348.5 L108 163.5 Z"
  />
  <path
    fill="#22d3ee"
    d="M150 338V174h32l52 96 52-96h32v164h-34V232l-40 74h-20l-40-74v106h-34zm196-158
      c0-28 22-44 58-44h52v34h-46c-16 0-26 6-26 20s10 20 30 26l36 10
      c38 12 56 34 56 68 0 44-34 70-86 70h-74v-34h78c24 0 40-12 40-32
      0-18-12-28-34-34l-38-12c-36-12-46-32-46-56z"
  />
`.trim();

export function brandMarkSvgSnippet(x: number, y: number, size: number): string {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 512 512" role="img" aria-label="Mohammed Sufyan">${BRAND_MARK_SVG_INNER}</svg>`;
}
