'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { EntityDefinition } from '@/types';
import logger from '@/lib/logger/logger';
import ComponentFallback from '@/components/fallbacks/ComponentFallback';

interface ChartWidgetConfig {
  entityName: string;
  chartType?: 'bar' | 'line' | 'area';
  xField: string;
  yField?: string;
  title?: string;
}

interface DynamicChartProps {
  appId: string;
  entities: EntityDefinition[];
  config?: ChartWidgetConfig;
  title?: string;
}

const CHART_COLORS = {
  primary: '#71717a',
  stroke: '#52525b',
  fill: 'rgba(113, 113, 122, 0.2)',
};

export default function DynamicChart({ appId, entities, config, title }: DynamicChartProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const resolvedConfig = config || {
    entityName: entities[0]?.name,
    chartType: 'bar' as const,
    xField: entities[0]?.fields?.[0]?.name || 'id',
    title: title || 'Chart',
  };

  useEffect(() => {
    if (!resolvedConfig.entityName) {
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      try {
        const res = await fetch(
          `/api/apps/${appId}/records?entityName=${encodeURIComponent(resolvedConfig.entityName)}`
        );
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || 'Failed to load chart data');
          logger.warn('DynamicChart', `Chart data fetch failed: ${json.error}`);
        } else {
          setRecords(json.records || []);
        }
      } catch (err: any) {
        setError('Network error loading chart data');
        logger.error('DynamicChart', 'Network error loading chart data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [appId, resolvedConfig.entityName]);

  const chartData = useMemo(() => {
    return records.slice(0, 20).map((r, i) => ({
      label: String(r.data?.[resolvedConfig.xField] ?? `Item ${i + 1}`).substring(0, 16),
      value: Number(r.data?.[resolvedConfig.yField || ''] ?? 1) || 1,
    }));
  }, [records, resolvedConfig]);

  const chartTitle = resolvedConfig.title || title || 'Chart';
  const chartType = resolvedConfig.chartType || 'bar';

  // Defensive Guard: prevent rendering if entity name cannot be resolved (placed safely after hooks)
  if (!resolvedConfig.entityName) {
    logger.warn('DynamicChart', 'Entity resolution failed for dynamic chart widget');
    return (
      <ComponentFallback
        componentType="chart"
        reason="No entity name resolved for dynamic data visualization. Verify configured entity bindings."
      />
    );
  }

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse mb-4" />
        <div className="h-48 bg-zinc-800 rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 flex items-center justify-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  const ChartComponent = () => {
    if (chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
          No data to visualize yet.
        </div>
      );
    }

    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 10, left: -10, bottom: 5 },
    };

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#71717a' }} />
            <YAxis tick={{ fontSize: 11, fill: '#71717a' }} />
            <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px', fontSize: '12px' }} />
            <Line type="monotone" dataKey="value" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#71717a' }} />
            <YAxis tick={{ fontSize: 11, fill: '#71717a' }} />
            <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px', fontSize: '12px' }} />
            <Area type="monotone" dataKey="value" stroke={CHART_COLORS.primary} fill="url(#areaGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#71717a' }} />
          <YAxis tick={{ fontSize: 11, fill: '#71717a' }} />
          <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px', fontSize: '12px' }} />
          <Bar dataKey="value" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <h3 className="text-sm font-semibold text-zinc-100 mb-4">{chartTitle}</h3>
      <ChartComponent />
    </div>
  );
}
