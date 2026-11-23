import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { useTheme } from '../theme/ThemeProvider';

interface MatrixNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  phase: number;
}

/**
 * Subtle hardware-accelerated 2D canvas security-mesh & vector matrix
 * strictly scoped behind the Hero section. Pauses cleanly under reduced motion.
 */
export default function HeroAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isLight, accent } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const isAmber = accent === 'amber';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    let animId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes: MatrixNode[] = [];
    const pointer = { x: -9999, y: -9999, active: false };

    // Match site accent tokens (canvas cannot use CSS remaps).
    const nodeColor = isAmber
      ? isLight
        ? '180, 83, 9'
        : '245, 158, 11'
      : isLight
        ? '3, 105, 161'
        : '56, 189, 248';
    const lineColor = isAmber
      ? isLight
        ? '146, 64, 14'
        : '217, 119, 6'
      : isLight
        ? '14, 116, 144'
        : '34, 211, 238';
    const contourColor = isAmber
      ? isLight
        ? 'rgba(180, 83, 9, 0.06)'
        : 'rgba(245, 158, 11, 0.055)'
      : isLight
        ? 'rgba(2, 132, 199, 0.06)'
        : 'rgba(56, 189, 248, 0.055)';

    const buildNodes = (w: number, h: number) => {
      const area = w * h;
      const targetCount = Math.max(26, Math.min(68, Math.round(area / 22000)));
      const next: MatrixNode[] = [];
      for (let i = 0; i < targetCount; i++) {
        next.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.24,
          vy: (Math.random() - 0.5) * 0.24,
          radius: 1.1 + Math.random() * 1.4,
          phase: Math.random() * Math.PI * 2,
        });
      }
      nodes = next;
    };

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildNodes(width, height);
    };

    resize();

    const drawStaticFrame = (timeMs: number) => {
      ctx.clearRect(0, 0, width, height);

      // Topographic horizon waves anchored calmly near bottom-right of Hero
      ctx.lineWidth = 1;
      ctx.strokeStyle = contourColor;
      const waveCount = 4;
      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath();
        const baseY = height * (0.48 + w * 0.13);
        const amp = 16 + w * 5;
        const speed = timeMs * 0.00028 + w * 0.7;
        for (let x = 0; x <= width; x += 28) {
          const y =
            baseY +
            Math.sin(x * 0.0045 + speed) * amp +
            Math.cos(x * 0.0022 - speed * 0.6) * (amp * 0.45);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      const maxDist = 145;
      const pointerRadius = 175;

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        const pulse = 0.55 + 0.45 * Math.sin(timeMs * 0.0014 + a.phase);

        // Pointer illumination
        let boost = 0;
        if (pointer.active) {
          const pdx = a.x - pointer.x;
          const pdy = a.y - pointer.y;
          const pDist = Math.hypot(pdx, pdy);
          if (pDist < pointerRadius) {
            boost = 1 - pDist / pointerRadius;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.strokeStyle = `rgba(${lineColor}, ${(boost * (isLight ? 0.16 : 0.22)).toFixed(3)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }

        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * (isLight ? 0.11 : 0.14) + boost * 0.08;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${lineColor}, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }

        const dotAlpha = (isLight ? 0.22 : 0.34) * pulse + boost * 0.45;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.radius + boost * 1.1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${nodeColor}, ${dotAlpha.toFixed(3)})`;
        ctx.fill();
      }
    };

    if (shouldReduceMotion) {
      drawStaticFrame(0);
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }

    const onPointerMove = (e: PointerEvent) => {
      const rect = parent.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        pointer.x = e.clientX - rect.left;
        pointer.y = e.clientY - rect.top;
        pointer.active = true;
      } else {
        pointer.active = false;
      }
    };

    const tick = (timeMs: number) => {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -12) n.x = width + 12;
        if (n.x > width + 12) n.x = -12;
        if (n.y < -12) n.y = height + 12;
        if (n.y > height + 12) n.y = -12;
      }
      drawStaticFrame(timeMs);
      animId = window.requestAnimationFrame(tick);
    };

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    animId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [isLight, isAmber, shouldReduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 opacity-85 print:hidden"
    />
  );
}
