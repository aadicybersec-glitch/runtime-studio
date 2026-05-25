"use client";

import React, { useEffect, useState, useTransition, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Editor from "@monaco-editor/react";
import { renderWidget } from "@/components/runtime/registry";
import { parseAppConfig, type ParseResult } from "@/lib/schema/schemaParser";
import logger, { type LogEntry } from "@/lib/logger/logger";
import {
  Loader2,
  Save,
  Play,
  History,
  Terminal,
  Activity,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileCode,
  Layout,
  RefreshCw,
  Info
} from "lucide-react";
import Link from "next/link";

interface WorkflowHistoryLog {
  id: string;
  workflowId: string;
  workflowName: string;
  triggerType: string;
  actionType: string;
  status: string;
  details: any;
  createdAt: string;
}

function EditorPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appId = searchParams.get("appId");

  // Local state for configuration editing
  const [appName, setAppName] = useState("");
  const [rawConfig, setRawConfig] = useState("");
  const [stableConfig, setStableConfig] = useState<any>(null); // For preview fallback
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  
  // UI Tabs & Navigation State
  const [activeTab, setActiveTab] = useState<"preview" | "logs">("preview");
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [telemetryLogs, setTelemetryLogs] = useState<LogEntry[]>([]);
  const [workflowLogs, setWorkflowLogs] = useState<WorkflowHistoryLog[]>([]);
  const [isLoadingWorkflowLogs, setIsLoadingWorkflowLogs] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Transition state to avoid Monaco lags during typing
  const [, startTransition] = useTransition();

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  // Load application from database
  useEffect(() => {
    if (status === "authenticated" && !appId) {
      router.push("/dashboard");
      return;
    }
    if (!appId || status !== "authenticated") return;

    const fetchApp = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/apps/${appId}`);
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || "Failed to load application.");
        }

        const app = data.app;
        setAppName(app.name);
        
        // Format the raw config beautifully
        let formatted = app.config;
        try {
          formatted = JSON.stringify(JSON.parse(app.config), null, 2);
        } catch {}

        setRawConfig(formatted);
        
        // Parse and resolve compilation tree
        const result = parseAppConfig(formatted);
        setParseResult(result);

        if (result.success && result.config) {
          setStableConfig(result.config);
          const pages = result.config.pages || [];
          if (pages.length > 0) {
            setActivePageId(pages[0].id);
          }
        }
        logger.info("Editor", `Loaded config for application: ${app.name}`);
      } catch (err: any) {
        logger.error("Editor", "Failed to retrieve application configuration", { error: err.message });
      } finally {
        setIsLoading(false);
      }
    };

    fetchApp();
  }, [appId, status]);

  // Telemetry drawer subscription
  useEffect(() => {
    // Set initial logs
    setTelemetryLogs(logger.getLogs());

    // Subscribe to runtime logs
    const unsubscribe = logger.subscribe((newLog) => {
      setTelemetryLogs((prev) => [newLog, ...prev].slice(0, 100));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Fetch background workflow logs
  const fetchWorkflowLogs = async () => {
    if (!appId) return;
    setIsLoadingWorkflowLogs(true);
    try {
      const res = await fetch(`/api/apps/${appId}/logs`);
      const data = await res.json();
      if (res.ok) {
        setWorkflowLogs(data.logs || []);
      }
    } catch (err: any) {
      logger.error("Editor", "Failed to fetch workflow histories", { error: err.message });
    } finally {
      setIsLoadingWorkflowLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === "logs") {
      fetchWorkflowLogs();
    }
  }, [activeTab]);

  // Debounced background auto-save for valid configuration schemas
  useEffect(() => {
    if (!appId || !parseResult?.success || !rawConfig) return;

    const timer = setTimeout(async () => {
      logger.info("Editor", "Background auto-save triggered for valid configuration schema...");
      try {
        const res = await fetch(`/api/apps/${appId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: rawConfig }),
        });
        if (res.ok) {
          logger.info("Editor", "[INFO] crudController → background configuration auto-saved successfully.");
        } else {
          logger.warn("Editor", "Background auto-save response status not OK.");
        }
      } catch (err: any) {
        logger.warn("Editor", `Background auto-save failed: ${err.message}`);
      }
    }, 1000); // 1000ms debounce

    return () => clearTimeout(timer);
  }, [rawConfig, parseResult?.success, appId]);


  // Live compilation parser trigger on change (debounced via transition)
  const handleEditorChange = (value: string | undefined) => {
    const text = value || "";
    setRawConfig(text);

    startTransition(() => {
      const result = parseAppConfig(text);
      setParseResult(result);

      if (result.success && result.config) {
        setStableConfig(result.config);
        // Set first page active if none selected
        if (!activePageId && result.config.pages?.length > 0) {
          setActivePageId(result.config.pages[0].id);
        }
      }
    });
  };

  // Save changes to database
  const handleSaveConfig = async () => {
    if (!appId) return;
    setIsSaving(true);
    setSaveStatus("idle");
    logger.info("Editor", "Saving configuration schema to database...");

    try {
      const res = await fetch(`/api/apps/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: rawConfig }),
      });

      if (!res.ok) {
        throw new Error("Failed to save.");
      }

      setSaveStatus("success");
      logger.info("Editor", "Database configuration successfully updated.");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err: any) {
      setSaveStatus("error");
      logger.error("Editor", "Configuration save failed", { error: err.message });
      setTimeout(() => setSaveStatus("idle"), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  // Form submission success trigger to reload tables/metrics on page
  const handleFormSuccess = () => {
    logger.info("Editor", "Inter-widget state notification: record created. Refreshing adjacent table widgets...");
    setRefreshTrigger((prev) => prev + 1);
    
    // Refresh workflow history if we are in logs tab
    if (activeTab === "logs") {
      setTimeout(fetchWorkflowLogs, 1000);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-2" />
        <p className="text-zinc-500 text-sm">Compiling workspace sandboxes...</p>
      </div>
    );
  }

  // Active page resolution
  const activePage = stableConfig?.pages?.find((p: any) => p.id === activePageId) || stableConfig?.pages?.[0];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col h-screen overflow-hidden">
      {/* Editor Top Navigation Header */}
      <header className="h-14 border-b border-zinc-900 bg-zinc-950 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight">{appName}</h1>
            <span className="text-xxs px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded">
              Sandbox IDE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Validation Status Indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-zinc-950 border border-zinc-900 rounded-lg">
            {parseResult?.success ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xxs text-zinc-400">
                  {parseResult.warnings.length > 0 ? "Recovered" : "Valid JSON Structure"}
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xxs text-zinc-400">Malformed Config</span>
              </>
            )}
          </div>

          <button
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-white disabled:bg-zinc-850 disabled:text-zinc-600 text-zinc-900 text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-md"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saveStatus === "success" ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {isSaving ? "Saving..." : saveStatus === "success" ? "Saved!" : "Save Changes"}
          </button>
        </div>
      </header>

      {/* Editor Split-Screen Layout Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Side: Monaco JSON Config Editor */}
        <div className="w-[45%] border-r border-zinc-900 flex flex-col min-w-0 bg-[#0c0c0e]">
          <div className="h-10 border-b border-zinc-900 bg-zinc-950/40 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-zinc-500" />
              <span className="text-xxs font-semibold uppercase tracking-wider text-zinc-400">schema.json</span>
            </div>
            {parseResult?.errors && parseResult.errors.length > 0 && (
              <span className="text-xxs text-red-400 font-semibold">
                {parseResult.errors.length} error(s)
              </span>
            )}
          </div>

          {/* Monaco Code Editor container */}
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              defaultLanguage="json"
              theme="vs-dark"
              value={rawConfig}
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                fontFamily: "Geist Mono, monospace",
                lineNumbers: "on",
                wordWrap: "on",
                automaticLayout: true,
                padding: { top: 12 },
                scrollbar: { verticalScrollbarSize: 8 },
              }}
            />
          </div>
        </div>

        {/* Right Side: Live Compiled Sandbox Viewport */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#09090b]">
          {/* Runtime viewport switcher */}
          <div className="h-10 border-b border-zinc-900 bg-zinc-950/40 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab("preview")}
                className={`px-3 py-1.5 rounded-lg text-xxs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${activeTab === "preview" ? "bg-zinc-900 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                <Layout className="w-3.5 h-3.5 inline mr-1" />
                Live Application
              </button>
              <button
                onClick={() => setActiveTab("logs")}
                className={`px-3 py-1.5 rounded-lg text-xxs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${activeTab === "logs" ? "bg-zinc-900 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                <History className="w-3.5 h-3.5 inline mr-1" />
                Workflow Logs
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRefreshTrigger((prev) => prev + 1)}
                className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors"
                title="Force reload sandbox runtime"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Viewport Core Renderer Container */}
          <div className="flex-1 overflow-y-auto p-6 min-w-0">
            {activeTab === "preview" ? (
              /* Subsystem Sandbox Rendering Tree Viewport */
              <div className="h-full flex flex-col">
                {stableConfig ? (
                  <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
                    {/* Sandbox app dynamic sidebar navigation */}
                    {stableConfig.layout?.sidebar && stableConfig.layout.sidebar.length > 0 && (
                      <div className="w-full md:w-48 shrink-0 flex flex-row md:flex-col gap-1 border-r border-zinc-900/60 pr-4">
                        {stableConfig.layout.sidebar.map((item: any) => (
                          <button
                            key={item.label}
                            onClick={() => setActivePageId(item.targetPage)}
                            className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer w-full ${activePageId === item.targetPage ? "bg-zinc-900 text-white" : "text-zinc-400 hover:bg-zinc-950/60 hover:text-zinc-200"}`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Sandbox active workspace page */}
                    <div className="flex-1 space-y-6">
                      {activePage ? (
                        <>
                          <div className="border-b border-zinc-900 pb-4">
                            <h2 className="text-xl font-semibold tracking-tight">{activePage.title}</h2>
                          </div>

                          <div className="space-y-6">
                            {(activePage.components || []).map((comp: any) => (
                              <div key={comp.id}>
                                {renderWidget(comp, undefined, {
                                  appId: appId!,
                                  config: stableConfig,
                                  refreshTrigger,
                                  onFormSuccess: handleFormSuccess,
                                })}
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="h-full border border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center p-8">
                          <Info className="w-8 h-8 text-zinc-500 mb-3" />
                          <p className="text-sm font-semibold text-zinc-400">No active pages configured</p>
                          <p className="text-xs text-zinc-600 mt-1 max-w-xs">
                            Define pages containing forms, tables, and dashboards inside the pages schema array.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-center p-8">
                    <div className="max-w-sm space-y-4">
                      <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
                      <p className="text-sm font-semibold">Configuration Error</p>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        The current configuration schema could not compile due to syntax or validation issues. Correct Monaco warnings to resume runtime previews.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Workflows automation log run-history trace drawer */
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Workflow Executions</h2>
                  <p className="text-xs text-zinc-500">Trace history of background webhook triggers, alerts, and dynamic mutations.</p>
                </div>

                {isLoadingWorkflowLogs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                  </div>
                ) : workflowLogs.length === 0 ? (
                  <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center text-zinc-500 text-sm">
                    No workflows have executed yet. Trigger one by submitting form record data.
                  </div>
                ) : (
                  <div className="border border-zinc-900 rounded-xl bg-zinc-950/40 divide-y divide-zinc-900 overflow-hidden shadow-lg">
                    {workflowLogs.map((log) => (
                      <div key={log.id} className="p-4 space-y-3 hover:bg-zinc-900/10 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xxs">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded font-mono font-medium ${log.status === "SUCCESS" ? "bg-emerald-950/60 border border-emerald-900/50 text-emerald-400" : "bg-red-950/60 border border-red-900/50 text-red-400"}`}>
                              {log.status}
                            </span>
                            <span className="font-semibold text-zinc-300">{log.workflowName}</span>
                            <span className="text-zinc-600 font-mono text-xxxs">({log.workflowId})</span>
                          </div>
                          <span className="text-zinc-500">{new Date(log.createdAt).toLocaleString()}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xxs text-zinc-400">
                          <div>
                            <span className="text-zinc-500 font-medium mr-1.5 uppercase">Trigger:</span>
                            <span className="font-mono">{log.triggerType}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 font-medium mr-1.5 uppercase">Action:</span>
                            <span className="font-mono">{log.actionType}</span>
                          </div>
                        </div>

                        <div className="bg-zinc-950/80 rounded-lg p-2.5 border border-zinc-900 font-mono text-xxs overflow-x-auto">
                          <p className="text-zinc-500 mb-1">// Event payload execution details</p>
                          <pre className="text-zinc-300">{JSON.stringify(log.details, null, 2)}</pre>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Diagnostic Panel & Console Trace Drawer */}
      <div className="h-[200px] border-t border-zinc-900 bg-zinc-950 flex flex-col shrink-0">
        <div className="h-9 border-b border-zinc-900 bg-zinc-950 px-4 flex items-center gap-3 select-none">
          <div className="flex items-center gap-1.5 text-xxs font-semibold uppercase tracking-wider text-zinc-400">
            <Terminal className="w-3.5 h-3.5 text-zinc-500" />
            <span>Diagnostics Console</span>
          </div>

          <span className="h-4 w-px bg-zinc-800" />

          {/* Trace Status Summary */}
          <div className="flex items-center gap-3 text-xxs text-zinc-500">
            {parseResult?.errors && parseResult.errors.length > 0 ? (
              <span className="flex items-center gap-1 text-red-400 font-medium">
                <XCircle className="w-3.5 h-3.5" />
                Compilation blocked
              </span>
            ) : parseResult?.warnings && parseResult.warnings.length > 0 ? (
              <span className="flex items-center gap-1 text-amber-500 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                Recovered with {parseResult.warnings.length} warning(s)
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-500 font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                Operational
              </span>
            )}
          </div>
        </div>

        {/* Drawer content (divided: Monaco compiler diagnostics on left, global trace updates on right) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel: active validation warnings & errors */}
          <div className="w-[45%] border-r border-zinc-900 overflow-y-auto p-4 space-y-2 font-mono text-xxs">
            {parseResult?.errors && parseResult.errors.length > 0 ? (
              <div className="space-y-2">
                <p className="text-red-400 font-semibold">// Ingestion Validation Failures</p>
                {parseResult.errors.map((err, i) => (
                  <div key={i} className="flex gap-2 text-red-500 bg-red-950/20 border border-red-900/35 p-2 rounded">
                    <span>⚡</span>
                    <div>
                      <p className="font-semibold">{err.message}</p>
                      {err.path && <p className="text-xxxs text-red-600 mt-0.5">at schema.{err.path}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : parseResult?.warnings && parseResult.warnings.length > 0 ? (
              <div className="space-y-2">
                <p className="text-amber-500 font-semibold">// Normalization Warnings (Resilient recovery active)</p>
                {parseResult.warnings.map((warn, i) => (
                  <div key={i} className="flex gap-2 text-amber-400 bg-amber-950/20 border border-amber-900/35 p-2 rounded">
                    <span>⚠️</span>
                    <div>
                      <p>{warn.message}</p>
                      {warn.path && <p className="text-xxxs text-amber-600 mt-0.5">at schema.{warn.path}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-zinc-600 italic py-2">
                No active compilation anomalies detected.
              </div>
            )}
          </div>

          {/* Right panel: system logs and trace events */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-xxs">
            <p className="text-zinc-500 font-semibold mb-2 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              // Live Telemetry Event Logger Stream
            </p>
            {telemetryLogs.length === 0 ? (
              <p className="text-zinc-700 italic">Listening for sandbox interaction traces...</p>
            ) : (
              telemetryLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 hover:bg-zinc-900/40 py-0.5 px-1 rounded transition-colors select-text">
                  <span className="text-zinc-600 shrink-0 select-none">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>
                  <span className={`px-1 rounded shrink-0 select-none text-xxxs ${log.level === "ERROR" ? "bg-red-950/80 text-red-400 border border-red-900/40" : log.level === "WARN" ? "bg-amber-950/80 text-amber-400 border border-amber-900/40" : "bg-emerald-950/80 text-emerald-400 border border-emerald-900/40"}`}>
                    {log.level}
                  </span>
                  <span className="text-zinc-400 shrink-0 font-semibold select-none">[{log.context}]</span>
                  <span className="text-zinc-300">{log.message}</span>
                  {log.details && (
                    <span className="text-zinc-600 truncate max-w-sm" title={JSON.stringify(log.details)}>
                      {JSON.stringify(log.details)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-2" />
          <p className="text-zinc-500 text-sm">Compiling workspace sandboxes...</p>
        </div>
      }
    >
      <EditorPageContent />
    </Suspense>
  );
}
