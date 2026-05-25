// src/components/fallbacks/ComponentFallback.tsx

import React from "react";

interface ComponentFallbackProps {
  componentType?: string;
  reason?: string;
  componentId?: string;
}

const WarningIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5 text-amber-400 flex-shrink-0"
    aria-hidden="true"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ComponentFallback: React.FC<ComponentFallbackProps> = ({
  componentType,
  reason,
  componentId,
}) => {
  const headline = componentType
    ? `Unknown component type: "${componentType}"`
    : "Component failed to render";

  return (
    <div
      role="alert"
      className="w-full rounded-xl border border-amber-500/30 bg-zinc-900 px-5 py-4 shadow-md"
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <WarningIcon />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-amber-300">
            {headline}
          </p>

          {/* Secondary meta */}
          <div className="mt-1.5 space-y-0.5">
            {reason && (
              <p className="text-xs text-zinc-400">
                <span className="font-medium text-zinc-300">Reason:</span>{" "}
                {reason}
              </p>
            )}
            {componentId && (
              <p className="text-xs text-zinc-500">
                <span className="font-medium text-zinc-400">Component ID:</span>{" "}
                <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-[11px] text-zinc-300">
                  {componentId}
                </code>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComponentFallback;
