import { BRAND_MARK_PNG_SRC } from '../brand/brandMark';
import type { ShareCardTrack } from './ogShare';

export type ShareCardTheme = 'dark' | 'light';
export type ShareCardAccent = 'cyan' | 'amber';

function loadImage(src: string, crossOrigin?: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = src;
  });
}

/** Renders the exact 1200×630 social share PNG used for download + live preview. */
export async function renderSocialShareCardPng(options: {
  track: ShareCardTrack;
  theme: ShareCardTheme;
  accent: ShareCardAccent;
}): Promise<string | null> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const cardLight = options.theme === 'light';
  const isAmber = options.accent === 'amber';
  const bg = cardLight ? '#f8fafc' : '#06080d';
  const panel = cardLight ? '#ffffff' : '#0b111f';
  const border = cardLight ? '#cbd5e1' : '#1e293b';
  const heading = cardLight ? '#0f172a' : '#f8fafc';
  const subtext = cardLight ? '#334155' : '#cbd5e1';
  const muted = cardLight ? '#64748b' : '#94a3b8';
  const accent = isAmber
    ? cardLight
      ? '#b45309'
      : '#f59e0b'
    : cardLight
      ? '#0284c7'
      : '#38bdf8';
  const accentSoft = isAmber
    ? cardLight
      ? '#fffbeb'
      : '#3b2a14'
    : cardLight
      ? '#e0f2fe'
      : '#082f49';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1200, 630);

  ctx.fillStyle = isAmber
    ? cardLight
      ? 'rgba(180,83,9,0.14)'
      : 'rgba(245,158,11,0.14)'
    : cardLight
      ? 'rgba(2,132,199,0.14)'
      : 'rgba(56,189,248,0.14)';
  for (let x = 24; x < 1200; x += 28) {
    for (let y = 24; y < 630; y += 28) {
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = panel;
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(44, 44, 1112, 542, 26);
  ctx.fill();
  ctx.stroke();

  // Same approved PNG tiles for dark + light (never muted SVG recolors).
  const brandSrc = isAmber
    ? '/pwa-192x192-amber.png'
    : BRAND_MARK_PNG_SRC;
  const brandImg = await loadImage(brandSrc, true);
  if (brandImg.naturalWidth > 0) {
    ctx.drawImage(brandImg, 92, 92, 56, 56);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = accent;
  ctx.font = 'bold 15px monospace';
  ctx.fillText('VERIFIED ARCHITECT PORTFOLIO', 166, 115);
  ctx.fillStyle = muted;
  ctx.font = '15px monospace';
  ctx.fillText('www.mohammedsufyan.com', 166, 140);

  const portrait = await loadImage(
    '/assets/aistudio/Sufyan_hero_portrait.png',
    true
  );
  if (portrait.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(1005, 195, 86, 0, Math.PI * 2);
    ctx.fillStyle = cardLight ? '#e2e8f0' : '#0f172a';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.clip();
    ctx.drawImage(portrait, 919, 109, 172, 172);
    ctx.restore();
  }

  ctx.fillStyle = heading;
  ctx.font = 'bold 46px system-ui, sans-serif';
  ctx.fillText(options.track.headline, 92, 240, 780);

  ctx.fillStyle = subtext;
  ctx.font = '500 24px system-ui, sans-serif';
  ctx.fillText(options.track.subline, 92, 294, 790);

  ctx.fillStyle = muted;
  ctx.font = '17px monospace';
  ctx.fillText(options.track.kicker, 92, 338, 790);

  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(92, 388);
  ctx.lineTo(1108, 388);
  ctx.stroke();

  options.track.metrics.forEach((metric, idx) => {
    const px = 92 + idx * 246;
    ctx.fillStyle = accentSoft;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px, 428, 224, 54, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.font = 'bold 19px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(metric, px + 112, 461);
  });

  ctx.textAlign = 'left';
  ctx.fillStyle = muted;
  ctx.font = '15px monospace';
  ctx.fillText(
    'Cisco Systems Inc. · HCL America Inc./HCLTech · Tata Consultancy Services',
    92,
    538
  );
  ctx.textAlign = 'right';
  ctx.fillStyle = accent;
  ctx.fillText('San Jose, CA · Global', 1108, 538);

  return canvas.toDataURL('image/png');
}
