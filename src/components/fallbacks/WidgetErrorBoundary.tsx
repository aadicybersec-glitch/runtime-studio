// src/components/fallbacks/WidgetErrorBoundary.tsx

import React from "react";

interface Props {
  children: React.ReactNode;
  componentId?: string;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class WidgetErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const { componentId, fallbackLabel } = this.props;
    console.error(
      "[WidgetErrorBoundary] Caught a rendering error.",
      {
        componentId: componentId ?? "(unknown)",
        fallbackLabel: fallbackLabel ?? "(none)",
        componentStack: info.componentStack,
      },
      error
    );
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    const { hasError, error } = this.state;
    const { children, fallbackLabel, componentId } = this.props;

    if (!hasError) {
      return children;
    }

    const label = fallbackLabel ?? "Widget";

    return (
      <div
        role="alert"
        className="w-full rounded-xl border border-red-500/40 bg-zinc-900 px-5 py-4 shadow-md"
      >
        {/* Title row */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-red-400" aria-hidden="true">
            ✕
          </span>
          <p className="text-sm font-semibold text-red-300">
            {label} encountered an error
          </p>
        </div>

        {/* Error message */}
        {error?.message && (
          <p className="mb-3 rounded bg-zinc-800 px-3 py-2 font-mono text-xs text-zinc-300 break-all">
            {error.message}
          </p>
        )}

        {/* Context */}
        {componentId && (
          <p className="mb-3 text-xs text-zinc-500">
            <span className="font-medium text-zinc-400">Component ID:</span>{" "}
            <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-[11px] text-zinc-300">
              {componentId}
            </code>
          </p>
        )}

        {/* Reset button */}
        <button
          type="button"
          onClick={this.handleReset}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {/* Refresh icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Try again
        </button>
      </div>
    );
  }
}

export default WidgetErrorBoundary;
