// src/lib/runtime/store.ts

import { create } from 'zustand'
import { parseAppConfig, type ParseResult } from '@/lib/schema/schemaParser'
import { type LogEntry } from '@/lib/logger/logger'

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface RuntimeStore {
  // Config editor state
  rawConfig: string
  parseResult: ParseResult | null
  isValidConfig: boolean

  // Selected app context
  activeAppId: string | null
  activePageId: string | null

  // Telemetry
  telemetryLogs: LogEntry[]

  // Actions
  setRawConfig: (config: string) => void
  setParseResult: (result: ParseResult) => void
  setActiveApp: (appId: string | null) => void
  setActivePage: (pageId: string | null) => void
  addTelemetryLog: (log: LogEntry) => void
  clearTelemetryLogs: () => void
}

// ---------------------------------------------------------------------------
// Maximum number of telemetry log entries retained in memory
// ---------------------------------------------------------------------------

const MAX_TELEMETRY_LOGS = 100

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useRuntimeStore = create<RuntimeStore>((set) => ({
  // ── Initial state ──────────────────────────────────────────────────────────

  rawConfig: '',
  parseResult: null,
  isValidConfig: false,

  activeAppId: null,
  activePageId: null,

  telemetryLogs: [],

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Update the raw JSON config string and automatically re-parse it.
   * Both `parseResult` and `isValidConfig` are kept in sync so consumers
   * never need to trigger a separate parse step.
   */
  setRawConfig: (config: string) => {
    const result = parseAppConfig(config)
    set({
      rawConfig: config,
      parseResult: result,
      isValidConfig: result.success,
    })
  },

  /**
   * Directly replace the current parse result (e.g. from an external parse
   * triggered outside the store, such as a server-side validation response).
   */
  setParseResult: (result: ParseResult) => {
    set({
      parseResult: result,
      isValidConfig: result.success,
    })
  },

  /**
   * Set the currently active app context.
   * Passing `null` clears the selection.
   */
  setActiveApp: (appId: string | null) => {
    set({ activeAppId: appId })
  },

  /**
   * Set the currently active page within the selected app.
   * Passing `null` clears the selection.
   */
  setActivePage: (pageId: string | null) => {
    set({ activePageId: pageId })
  },

  /**
   * Prepend a new log entry to the telemetry list.
   * The list is capped at MAX_TELEMETRY_LOGS entries; the oldest entries are
   * silently dropped once the limit is reached.
   */
  addTelemetryLog: (log: LogEntry) => {
    set((state) => ({
      telemetryLogs: [log, ...state.telemetryLogs].slice(0, MAX_TELEMETRY_LOGS),
    }))
  },

  /**
   * Remove all in-memory telemetry log entries.
   */
  clearTelemetryLogs: () => {
    set({ telemetryLogs: [] })
  },
}))
