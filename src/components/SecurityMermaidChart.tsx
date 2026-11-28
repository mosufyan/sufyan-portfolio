import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from '../theme/ThemeProvider';

interface SecurityMermaidChartProps {
  chart: string;
  className?: string;
  onNodeClick?: (nodeId: string) => void;
}

/**
 * Lazy-loads Mermaid for architecture diagrams inside the security modal.
 * Theme follows site light/dark; accent remaps via existing cyan/amber CSS.
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
    const render = async () => {
      setError(null);
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: isLight ? 'neutral' : 'dark',
          flowchart: { curve: 'basis', htmlLabels: true },
          themeVariables: isLight
            ? {
                primaryColor: '#e0f2fe',
                primaryTextColor: '#0f172a',
                primaryBorderColor: '#0284c7',
                lineColor: '#64748b',
                secondaryColor: '#f0fdf4',
                tertiaryColor: '#fef3c7',
              }
            : {
                primaryColor: '#083344',
                primaryTextColor: '#e2e8f0',
                primaryBorderColor: '#22d3ee',
                lineColor: '#64748b',
                secondaryColor: '#052e16',
                tertiaryColor: '#451a03',
              },
        });
        const id = `sec-mermaid-${reactId}-${Date.now().toString(36)}`;
        const { svg, bindFunctions } = await mermaid.render(id, chart);
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        if (bindFunctions) bindFunctions(containerRef.current);

        if (onNodeClick) {
          containerRef.current.querySelectorAll('.node').forEach((node) => {
            const el = node as HTMLElement;
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
              const nodeId = el.id?.replace(/^flowchart-/, '').replace(/-\d+$/, '') || el.id;
              onNodeClick(nodeId || el.getAttribute('data-id') || 'node');
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
