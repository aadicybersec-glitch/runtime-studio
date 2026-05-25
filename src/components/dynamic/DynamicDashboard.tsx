'use client';

import React, { useEffect, useState } from 'react';
import type { AppConfig, EntityDefinition } from '@/types';
import logger from '@/lib/logger/logger';
import ComponentFallback from '@/components/fallbacks/ComponentFallback';

interface MetricCard {
  label: string;
  entityName: string;
  aggregation?: 'count' | 'sum' | 'avg';
  field?: string;
}

interface DynamicDashboardProps {
  appId: string;
  config: AppConfig;
  title?: string;
}

function StatCard({ label, value, loading }: { label: string; value: string | number; loading: boolean }) {
  return (
    <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-5">
      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">{label}</p>
      {loading ? (
        <div className="h-7 w-16 bg-zinc-700 rounded animate-pulse" />
      ) : (
        <p className="text-2xl font-semibold text-zinc-100">{value}</p>
      )}
    </div>
  );
}

export default function DynamicDashboard({ appId, config, title }: DynamicDashboardProps) {
  const [entityCounts, setEntityCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!config) {
      setLoading(false);
      return;
    }
    const fetchCounts = async () => {
      const results: Record<string, number> = {};
      await Promise.all(
        (config.entities || []).map(async (entity) => {
          if (!entity?.name) return;
          try {
            const res = await fetch(
              `/api/apps/${appId}/records?entityName=${encodeURIComponent(entity.name)}`
            );
            if (res.ok) {
              const json = await res.json();
              results[entity.name] = json.records?.length ?? 0;
            }
          } catch (err) {
            logger.warn('DynamicDashboard', `Failed to fetch count for entity: ${entity.name}`, err);
            results[entity.name] = 0;
          }
        })
      );
      setEntityCounts(results);
      setLoading(false);
    };

    if ((config.entities || []).length > 0) {
      fetchCounts();
    } else {
      setLoading(false);
    }
  }, [appId, config?.entities]);

  // Defensive Guard: prevent rendering if config metadata is completely unresolved
  if (!config || !config.entities) {
    logger.warn('DynamicDashboard', 'Entity resolution failed for dynamic dashboard widget');
    return (
      <ComponentFallback
        componentType="dashboard"
        reason="Unable to resolve application configuration metadata or entities list."
      />
    );
  }

  const totalRecords = Object.values(entityCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">{title || config.appName || 'Dashboard'}</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Overview of all generated application data</p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Records" value={totalRecords} loading={loading} />
        <StatCard label="Entities" value={config.entities?.length ?? 0} loading={false} />
        <StatCard label="Pages" value={config.pages?.length ?? 0} loading={false} />
        <StatCard label="Workflows" value={config.workflows?.length ?? 0} loading={false} />
      </div>

      {/* Per-entity breakdown */}
      {(config.entities || []).length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-100">Entity Record Counts</h3>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {config.entities.map((entity) => {
              if (!entity || !entity.fields || !Array.isArray(entity.fields)) {
                return (
                  <div key={entity?.name || Math.random().toString()} className="px-5 py-3 text-xs text-amber-500 italic">
                    ⚠️ Invalid or unresolved metadata for entity &ldquo;{entity?.name || "Unnamed"}&rdquo;
                  </div>
                );
              }
              const count = entityCounts[entity.name] ?? 0;
              const max = Math.max(...Object.values(entityCounts), 1);
              const pct = Math.round((count / max) * 100);
              return (
                <div key={entity.name} className="px-5 py-3 flex items-center gap-4">
                  <div className="w-32 shrink-0">
                    <p className="text-sm text-zinc-300 truncate">{entity.name}</p>
                    <p className="text-xs text-zinc-500">{entity.fields.length} fields</p>
                  </div>
                  <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    {loading ? (
                      <div className="h-full bg-zinc-700 animate-pulse rounded-full" style={{ width: '60%' }} />
                    ) : (
                      <div
                        className="h-full bg-zinc-400 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    )}
                  </div>
                  <div className="w-12 text-right shrink-0">
                    {loading ? (
                      <div className="h-3 w-8 bg-zinc-700 rounded animate-pulse ml-auto" />
                    ) : (
                      <p className="text-sm font-medium text-zinc-200">{count}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Entity field summary */}
      {(config.entities || []).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {config.entities.slice(0, 4).map((entity) => {
            if (!entity || !entity.fields || !Array.isArray(entity.fields)) {
              return (
                <div key={entity?.name || Math.random().toString()} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex items-center justify-center text-xs text-amber-500 italic">
                  ⚠️ Invalid or unresolved schema details
                </div>
              );
            }
            return (
              <div key={entity.name} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <h4 className="text-sm font-semibold text-zinc-100 mb-3">{entity.name} Schema</h4>
                <div className="space-y-1.5">
                  {entity.fields.slice(0, 5).map((field) => (
                    <div key={field.name} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{field.label || field.name}</span>
                      <span className="text-xs font-mono text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                        {field.type}
                      </span>
                    </div>
                  ))}
                  {entity.fields.length > 5 && (
                    <p className="text-xs text-zinc-600">+{entity.fields.length - 5} more fields</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(config.entities || []).length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-400 text-sm font-medium">No entities configured</p>
          <p className="text-zinc-600 text-xs mt-1">Add entity definitions to your configuration to see dashboard metrics.</p>
        </div>
      )}
    </div>
  );
}
