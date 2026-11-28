import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from '../theme/ThemeProvider';

interface SecurityMermaidChartProps {
  chart: string;
  className?: string;
  onNodeClick?: (nodeId: string) => void;
}

const ACTOR_PALETTE_DARK = ['#083344', '#2e1065', '#052e16', '#451a03', '#1e3a8a', '#3b0764'];
const ACTOR_PALETTE_LIGHT = ['#e0f2fe', '#ede9fe', '#d1fae5', '#fef3c7', '#dbeafe', '#f3e8ff'];
const ACTOR_BORDER_DARK = ['#22d3ee', '#c084fc', '#34d399', '#fbbf24', '#60a5fa', '#e879f9'];
const ACTOR_BORDER_LIGHT = ['#0284c7', '#7c3aed', '#059669', '#d97706', '#2563eb', '#a21caf'];

/**
 * Lazy-loads Mermaid for architecture diagrams inside the portfolio architecture modal.
 * Applies colorful theme + click handlers for flowchart nodes and sequence actors.
 */
export default function SecurityMermaidChart({
  chart,
  className = '',
  onNodeClick,
}: SecurityMermaidChartProps) {
  const { isLight } = useTheme();
  const reactId = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const listeners: Array<{ el: Element; type: string; fn: EventListener }> = [];

    const addClick = (el: Element, fn: EventListener) => {
      el.addEventListener('click', fn);
      listeners.push({ el, type: 'click', fn });
      (el as HTMLElement).style.cursor = 'pointer';
    };

    const colorizeSequence = (root: HTMLElement) => {
      const fills = isLight ? ACTOR_PALETTE_LIGHT : ACTOR_PALETTE_DARK;
      const borders = isLight ? ACTOR_BORDER_LIGHT : ACTOR_BORDER_DARK;
      const actorRects = root.querySelectorAll('rect.actor, .actor > rect, g[class*="actor"] rect');
      actorRects.forEach((rect, idx) => {
        const i = idx % fills.length;
        rect.setAttribute('fill', fills[i]);
        rect.setAttribute('stroke', borders[i]);
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('rx', '8');
      });
      root.querySelectorAll('.messageLine0, .messageLine1').forEach((line, idx) => {
        const color = borders[idx % borders.length];
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '2');
      });
      root.querySelectorAll('circle').forEach((c, idx) => {
        c.setAttribute('fill', borders[idx % borders.length]);
      });
      root.querySelectorAll('.loopLine, .note').forEach((el) => {
        el.setAttribute('stroke', isLight ? '#d97706' : '#fbbf24');
      });
    };

    const render = async () => {
      setError(null);
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          flowchart: { curve: 'basis', htmlLabels: true, padding: 12 },
          sequence: {
            actorMargin: 48,
            messageMargin: 36,
            mirrorActors: false,
            useMaxWidth: true,
            rightAngles: false,
          },
          themeVariables: isLight
            ? {
                primaryColor: '#e0f2fe',
                primaryTextColor: '#0f172a',
                primaryBorderColor: '#0284c7',
                secondaryColor: '#ede9fe',
                tertiaryColor: '#d1fae5',
                lineColor: '#64748b',
                textColor: '#0f172a',
                mainBkg: '#f8fafc',
                nodeBorder: '#0284c7',
                clusterBkg: '#f1f5f9',
                titleColor: '#0f172a',
                actorBkg: '#e0f2fe',
                actorBorder: '#0284c7',
                actorTextColor: '#0f172a',
                actorLineColor: '#94a3b8',
                signalColor: '#7c3aed',
                signalTextColor: '#0f172a',
                labelBoxBkgColor: '#fef3c7',
                labelBoxBorderColor: '#d97706',
                labelTextColor: '#0f172a',
                loopTextColor: '#b45309',
                noteBkgColor: '#ecfccb',
                noteTextColor: '#14532d',
                noteBorderColor: '#65a30d',
                activationBkgColor: '#ddd6fe',
                activationBorderColor: '#7c3aed',
                sequenceNumberColor: '#ffffff',
              }
            : {
                primaryColor: '#083344',
                primaryTextColor: '#e2e8f0',
                primaryBorderColor: '#22d3ee',
                secondaryColor: '#2e1065',
                tertiaryColor: '#052e16',
                lineColor: '#94a3b8',
                textColor: '#e2e8f0',
                mainBkg: '#0a101c',
                nodeBorder: '#22d3ee',
                clusterBkg: '#111827',
                titleColor: '#f8fafc',
                actorBkg: '#083344',
                actorBorder: '#22d3ee',
                actorTextColor: '#e2e8f0',
                actorLineColor: '#475569',
                signalColor: '#c084fc',
                signalTextColor: '#e2e8f0',
                labelBoxBkgColor: '#451a03',
                labelBoxBorderColor: '#fbbf24',
                labelTextColor: '#fef3c7',
                loopTextColor: '#fbbf24',
                noteBkgColor: '#052e16',
                noteTextColor: '#bbf7d0',
                noteBorderColor: '#34d399',
                activationBkgColor: '#3b0764',
                activationBorderColor: '#e879f9',
                sequenceNumberColor: '#0f172a',
              },
        });
        const id = `sec-mermaid-${reactId}-${Date.now().toString(36)}`;
        const { svg, bindFunctions } = await mermaid.render(id, chart);
        if (cancelled || !containerRef.current) return;
        const DOMPurify = (await import('dompurify')).default;
        const clean = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true, svgFilters: true },
          ADD_TAGS: ['foreignObject'],
          ADD_ATTR: ['target'],
        });
        containerRef.current.innerHTML = clean;
        if (bindFunctions) bindFunctions(containerRef.current);
        colorizeSequence(containerRef.current);

        if (onNodeClick) {
          containerRef.current.querySelectorAll('.node').forEach((node) => {
            addClick(node, () => {
              const el = node as HTMLElement;
              const nodeId =
                el.id?.replace(/^flowchart-/, '').replace(/-\d+$/, '') ||
                el.getAttribute('data-id') ||
                'node';
              onNodeClick(nodeId);
            });
          });

          // Sequence diagram actors / labels
          containerRef.current.querySelectorAll('.actor, text.actor, .actor-man').forEach((node) => {
            addClick(node, () => {
              const label = (node.textContent || '').trim().toLowerCase();
              onNodeClick(label || 'actor');
            });
          });

          containerRef.current.querySelectorAll('.messageText').forEach((node) => {
            addClick(node, () => {
              const label = (node.textContent || '').trim().toLowerCase();
              onNodeClick(label || 'message');
            });
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Diagram failed to render');
        }
      }
    };
    void render();
    return () => {
      cancelled = true;
      listeners.forEach(({ el, type, fn }) => el.removeEventListener(type, fn));
    };
  }, [chart, isLight, onNodeClick, reactId]);

  if (error) {
    return (
      <p className={`text-[11px] ${isLight ? 'text-rose-700' : 'text-rose-300'}`}>
        Diagram unavailable: {error}
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto ${className}`}
      aria-label="Interactive architecture diagram"
    />
  );
}
