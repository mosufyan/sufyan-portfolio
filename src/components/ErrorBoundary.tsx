import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { toUserFacingError } from '../utils/userFacingError';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: toUserFacingError(error, 'An unexpected error occurred.'),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary caught error:', error, info.componentStack);
    try {
      void fetch('/api/telemetry/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message?.slice(0, 500) || 'Unknown client error',
          stack: error.stack?.slice(0, 2000),
          componentStack: info.componentStack?.slice(0, 2000),
        }),
        keepalive: true,
      });
    } catch {
      /* ignore reporting failures */
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#06080d] text-slate-200 p-6">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-[#0b101b] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display font-bold text-base text-white">
                  Something went wrong
                </h2>
                <p className="text-xs font-mono text-slate-400">
                  A recoverable rendering or data error occurred
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#070a12] p-3 text-xs font-mono text-rose-300 break-words max-h-36 overflow-y-auto">
              {this.state.message}
            </div>

            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reload View</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
