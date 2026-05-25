"use client";

import React, { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, LayoutGrid, Calendar, LogOut, ArrowRight, Loader2, Sparkles, AlertCircle, Laptop, Settings } from "lucide-react";
import logger from "@/lib/logger/logger";

interface AppData {
  id: string;
  name: string;
  description: string | null;
  config: string;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [apps, setApps] = useState<AppData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // New App Form State
  const [newAppName, setNewAppName] = useState("");
  const [newAppDesc, setNewAppDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  const fetchApps = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/apps");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch applications.");
      }
      setApps(data.apps || []);
    } catch (err: any) {
      logger.error("Dashboard", "Error fetching applications", { error: err.message });
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchApps();
    }
  }, [status]);

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppName.trim()) return;

    setIsCreating(true);
    setError(null);
    logger.info("Dashboard", `Creating new app: ${newAppName}`);

    try {
      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newAppName.trim(),
          description: newAppDesc.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create application.");
      }

      logger.info("Dashboard", `App successfully created. ID: ${data.app.id}`);
      setIsModalOpen(false);
      setNewAppName("");
      setNewAppDesc("");
      
      // Redirect straight to live preview editor for direct configuration
      router.push(`/editor?appId=${data.app.id}`);
    } catch (err: any) {
      logger.error("Dashboard", "Error creating application", { error: err.message });
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  if (status === "loading" || (status === "authenticated" && isLoading && apps.length === 0)) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-2" />
        <p className="text-zinc-500 text-sm">Loading your applications workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      {/* Premium Navigation Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">AppForge</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-zinc-200">{session?.user?.name || "Active Developer"}</p>
              <p className="text-xxs text-zinc-500">{session?.user?.email}</p>
            </div>

            <button
              onClick={() => {
                logger.info("Dashboard", "Signing out...");
                signOut({ callbackUrl: "/" });
              }}
              className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-all cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-8">
        {/* Workspace Intro Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-medium tracking-tight">Applications</h2>
            <p className="text-sm text-zinc-400">Generate, customize, and orchestrate dynamic full-stack runtime systems.</p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-medium rounded-lg transition-all duration-150 cursor-pointer shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Create Application
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-950/40 border border-red-900/50 rounded-xl text-xs text-red-400 animate-fadeIn">
            <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Apps Grid */}
        {apps.length === 0 ? (
          /* Empty State Dashboard */
          <div className="border border-zinc-900 rounded-2xl bg-zinc-950/20 p-16 text-center space-y-6 max-w-md mx-auto mt-12 shadow-2xl">
            <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center mx-auto text-zinc-400 shadow-inner">
              <Laptop className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-zinc-200">No applications found</h3>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                AppForge metadata configurations compile instantly. Get started by designing your first runtime sandbox.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-medium rounded-lg hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Configure Live Sandbox
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {apps.map((app) => (
              <div
                key={app.id}
                className="group relative bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-200 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 bg-zinc-900 border border-zinc-850 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-emerald-500 transition-colors shadow-inner">
                      <LayoutGrid className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-semibold text-zinc-200 group-hover:text-white transition-colors tracking-tight text-lg">
                      {app.name}
                    </h3>
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {app.description || "No description provided."}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-900 flex items-center justify-between text-zinc-500 text-xxs">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Created {new Date(app.createdAt).toLocaleDateString()}</span>
                  </div>

                  <Link
                    href={`/editor?appId=${app.id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 group-hover:bg-zinc-100 group-hover:text-zinc-900 rounded-md font-medium text-zinc-400 transition-all duration-200"
                  >
                    <span>Launch</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Elegant Modals Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-850 rounded-2xl max-w-md w-full p-8 shadow-2xl space-y-6 animate-scaleIn">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold tracking-tight text-zinc-100">Create Application</h3>
              <p className="text-xs text-zinc-400">Initialize a sandboxed application workspace configuration.</p>
            </div>

            <form onSubmit={handleCreateApp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400" htmlFor="appName">
                  Application Name
                </label>
                <input
                  id="appName"
                  type="text"
                  required
                  placeholder="Billing Automation Suite"
                  className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-700 transition-colors"
                  value={newAppName}
                  onChange={(e) => setNewAppName(e.target.value)}
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400" htmlFor="appDesc">
                  Description (Optional)
                </label>
                <textarea
                  id="appDesc"
                  placeholder="Handles user ledger accounts, dynamic invoice generation, and slack callbacks."
                  rows={3}
                  className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-700 transition-colors resize-none"
                  value={newAppDesc}
                  onChange={(e) => setNewAppDesc(e.target.value)}
                  disabled={isCreating}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setNewAppName("");
                    setNewAppDesc("");
                  }}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:text-white rounded-lg text-xs font-medium text-zinc-400 transition-all cursor-pointer"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newAppName.trim()}
                  className="px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Initialize Workspace"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
