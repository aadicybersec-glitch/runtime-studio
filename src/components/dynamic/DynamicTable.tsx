'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { EntityDefinition } from '@/types';
import logger from '@/lib/logger/logger';
import ComponentFallback from '@/components/fallbacks/ComponentFallback';

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
}

interface DynamicTableProps {
  entity: EntityDefinition;
  appId: string;
  title?: string;
  refreshTrigger?: number;
}

type SortDirection = 'asc' | 'desc';

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 bg-zinc-800 rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export default function DynamicTable({ entity, appId, title, refreshTrigger }: DynamicTableProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pageSize = 10;

  const fields = entity?.fields || [];
  // Derive column definitions from the entity schema
  const columns: Column[] = useMemo(
    () =>
      fields.map((f) => ({
        key: f.name,
        label: f.label || f.name,
        sortable: ['text', 'number', 'email', 'date', 'select'].includes(f.type),
      })),
    [fields]
  );

  const fetchRecords = async () => {
    if (!entity?.name) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/records?entityName=${encodeURIComponent(entity.name)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to load records');
        logger.warn('DynamicTable', `Failed to fetch records: ${json.error}`, { entity: entity.name });
      } else {
        setRecords(json.records || []);
      }
    } catch (err: any) {
      setError('Network error — could not reach the server');
      logger.error('DynamicTable', 'Network error fetching records', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (entity?.name) {
      fetchRecords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, entity?.name, refreshTrigger]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/apps/${appId}/records/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
        logger.info('DynamicTable', `Record deleted: ${id}`);
      }
    } catch (err) {
      logger.error('DynamicTable', 'Failed to delete record', err);
    } finally {
      setDeletingId(null);
    }
  };

  // Filter + sort + paginate pipeline
  const processed = useMemo(() => {
    let result = [...records];

    // Search across all string fields
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter((r) => {
        const data = r.data || {};
        return columns.some((col) =>
          String(data[col.key] ?? '').toLowerCase().includes(term)
        );
      });
    }

    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        const av = a.data?.[sortKey] ?? '';
        const bv = b.data?.[sortKey] ?? '';
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [records, search, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
  const paged = processed.slice((page - 1) * pageSize, page * pageSize);

  const SortIcon = ({ col }: { col: Column }) => {
    if (!col.sortable) return null;
    const active = sortKey === col.key;
    return (
      <span className={`ml-1 text-xs ${active ? 'text-zinc-200' : 'text-zinc-600'}`}>
        {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    );
  };

  // Defensive Guard: prevent rendering if entity metadata hydration failed
  if (!entity || !entity.fields || !Array.isArray(entity.fields)) {
    logger.warn('DynamicTable', 'Entity resolution failed for dynamic table widget');
    return (
      <ComponentFallback
        componentType="table"
        reason="Unable to resolve entity metadata. Verify configured entity bindings."
      />
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">{title || entity.name}</h3>
          {!loading && (
            <p className="text-xs text-zinc-500 mt-0.5">
              {processed.length} {processed.length === 1 ? 'record' : 'records'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-md px-3 py-1.5 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 w-48"
          />
          <button
            onClick={fetchRecords}
            title="Refresh"
            className="text-zinc-400 hover:text-zinc-100 p-1.5 rounded hover:bg-zinc-800 transition-colors"
          >
            ↺
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="px-5 py-4 bg-red-950 border-b border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={`px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider select-none ${col.sortable ? 'cursor-pointer hover:text-zinc-200' : ''}`}
                >
                  {col.label}
                  <SortIcon col={col} />
                </th>
              ))}
              <th className="px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={i} cols={columns.length + 1} />
                ))
              : paged.length === 0
              ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-zinc-500 text-sm">
                    {search ? 'No records match your search.' : 'No records yet. Create one using the form.'}
                  </td>
                </tr>
              )
              : paged.map((record) => (
                <tr key={record.id} className="hover:bg-zinc-800/40 transition-colors">
                  {columns.map((col) => {
                    const val = record.data?.[col.key];
                    const display = Array.isArray(val)
                      ? val.join(', ')
                      : val === true
                      ? '✓'
                      : val === false
                      ? '✗'
                      : val == null
                      ? <span className="text-zinc-600">—</span>
                      : String(val);
                    return (
                      <td key={col.key} className="px-4 py-3 text-zinc-300 max-w-xs truncate">
                        {display}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(record.id)}
                      disabled={deletingId === record.id}
                      className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-40 transition-colors"
                    >
                      {deletingId === record.id ? '…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-zinc-950">
          <span className="text-xs text-zinc-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-2.5 py-1 text-xs text-zinc-400 border border-zinc-700 rounded hover:bg-zinc-800 disabled:opacity-30 transition-colors"
            >
              ← Prev
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 text-xs text-zinc-400 border border-zinc-700 rounded hover:bg-zinc-800 disabled:opacity-30 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
