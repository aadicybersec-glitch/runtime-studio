"use client";

import React, { useEffect, useState } from "react";
import { WifiOff, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center px-4 text-center">
      <div className="max-w-md w-full border border-zinc-900 bg-zinc-950/40 backdrop-blur-xl rounded-2xl p-8 shadow-2xl space-y-6">
        {/* Offline Badge */}
        <div className="w-14 h-14 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto text-zinc-400">
          <WifiOff className="w-6 h-6 text-zinc-400 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            {isOnline ? "Connection Restored" : "Offline Sandbox Active"}
          </h1>
          <p className="text-xs text-zinc-500 leading-relaxed max-w-xs mx-auto">
            {isOnline 
              ? "You are back online. Click refresh to resume live server execution syncs." 
              : "AppForge is running in local offline sandbox mode. Dynamic database modifications are cached."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {isOnline ? (
            <button
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload Workspace
            </button>
          ) : (
            <button
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Check Connection
            </button>
          )}

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-transparent border border-zinc-900 hover:border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-semibold rounded-lg transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            Home Screen
          </Link>
        </div>
      </div>
    </main>
  );
}
