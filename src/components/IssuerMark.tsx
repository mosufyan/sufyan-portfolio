interface IssuerMarkProps {
  issuer: string;
  size?: 'sm' | 'md';
  theme?: 'dark' | 'light';
}

export default function IssuerMark({ issuer, size = 'sm', theme = 'dark' }: IssuerMarkProps) {
  const lower = issuer.toLowerCase();
  const boxClass = size === 'md' ? 'w-7 h-7 rounded-lg' : 'w-5 h-5 rounded-md';
  const iconClass = size === 'md' ? 'w-4 h-4' : 'w-3 h-3';
  const isLight = theme === 'light';

  if (lower.includes('amazon') || lower.includes('aws')) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center shrink-0 ${boxClass} ${
          isLight
            ? 'bg-amber-50 border border-amber-300 text-amber-700'
            : 'bg-amber-500/15 border border-amber-400/35 text-amber-300'
        }`}
        title="Amazon Web Services (AWS)"
      >
        <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
          <path d="M4 15.5c4.5 3.2 11.5 3.2 16 0" />
          <path d="M17.5 14l2.5 1.5-1.5 2.5" />
          <path d="M6 10.5L8.2 6l2.2 4.5M6.7 9.2h3" />
          <path d="M12.5 6l1.3 4.5L15 7l1.2 3.5L17.5 6" />
        </svg>
      </span>
    );
  }

  if (lower.includes('microsoft')) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center shrink-0 ${boxClass} ${
          isLight ? 'bg-sky-50 border border-sky-200' : 'bg-sky-500/15 border border-sky-400/35'
        }`}
        title="Microsoft"
      >
        <svg viewBox="0 0 16 16" className={iconClass}>
          <rect x="1.5" y="1.5" width="5.8" height="5.8" rx="0.6" fill="#f25022" />
          <rect x="8.7" y="1.5" width="5.8" height="5.8" rx="0.6" fill="#7fba00" />
          <rect x="1.5" y="8.7" width="5.8" height="5.8" rx="0.6" fill="#00a4ef" />
          <rect x="8.7" y="8.7" width="5.8" height="5.8" rx="0.6" fill="#ffb900" />
        </svg>
      </span>
    );
  }

  if (lower.includes('google')) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center shrink-0 ${boxClass} ${
          isLight ? 'bg-blue-50 border border-blue-200' : 'bg-blue-500/15 border border-blue-400/35'
        }`}
        title="Google Cloud"
      >
        <svg viewBox="0 0 24 24" className={iconClass} fill="none">
          <path d="M20.6 12.2c0-.6-.1-1.2-.2-1.8H12v3.6h4.8c-.2 1.1-.8 2-1.8 2.6v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.6z" fill="#4285F4" />
          <path d="M12 21c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H3.9v2.3C5.4 19 8.5 21 12 21z" fill="#34A853" />
          <path d="M6.9 13.7c-.2-.5-.3-1.1-.3-1.7s.1-1.2.3-1.7V8H3.9C3.3 9.2 3 10.6 3 12s.3 2.8.9 4l3-2.3z" fill="#FBBC05" />
          <path d="M12 6.5c1.3 0 2.5.5 3.4 1.3l2.6-2.6C16.5 3.8 14.4 3 12 3 8.5 3 5.4 5 3.9 8l3 2.3c.7-2.2 2.7-3.8 5.1-3.8z" fill="#EA4335" />
        </svg>
      </span>
    );
  }

  if (lower.includes('databricks')) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center shrink-0 ${boxClass} ${
          isLight
            ? 'bg-rose-50 border border-rose-200 text-rose-600'
            : 'bg-rose-500/15 border border-rose-400/35 text-rose-400'
        }`}
        title="Databricks"
      >
        <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="12 3 21 8 12 13 3 8 12 3" />
          <polyline points="3 12.5 12 17.5 21 12.5" />
          <polyline points="3 17 12 22 21 17" />
        </svg>
      </span>
    );
  }

  if (lower.includes('skillsoft')) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center shrink-0 ${boxClass} font-mono font-bold text-[10px] ${
          isLight
            ? 'bg-indigo-50 border border-indigo-200 text-indigo-700'
            : 'bg-indigo-500/15 border border-indigo-400/35 text-indigo-300'
        }`}
        title="Skillsoft"
      >
        S
      </span>
    );
  }

  if (lower.includes('guvi')) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center shrink-0 ${boxClass} font-mono font-bold text-[10px] ${
          isLight
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : 'bg-emerald-500/15 border border-emerald-400/35 text-emerald-300'
        }`}
        title="HCL GUVI"
      >
        G
      </span>
    );
  }

  if (lower.includes('be10x')) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center shrink-0 ${boxClass} font-mono font-bold text-[9px] ${
          isLight
            ? 'bg-violet-50 border border-violet-200 text-violet-700'
            : 'bg-violet-500/15 border border-violet-400/35 text-violet-300'
        }`}
        title="Be10x"
      >
        10x
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center shrink-0 ${boxClass} font-mono font-bold text-[10px] ${
        isLight
          ? 'bg-sky-50 border border-sky-200 text-sky-700'
          : 'bg-cyan-500/15 border border-cyan-400/35 text-cyan-300'
      }`}
      title={issuer}
    >
      AI
    </span>
  );
}
