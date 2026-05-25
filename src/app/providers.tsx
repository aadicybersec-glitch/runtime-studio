"use client";

import React, { useEffect, Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import logger from "@/lib/logger/logger";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Register service worker defensively upon window load completion
      const registerSW = () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            logger.info("PWA", "Service Worker registered successfully.", { scope: reg.scope });
          })
          .catch((err) => {
            logger.error("PWA", "Service Worker registration failed.", { error: err.message });
          });
      };

      if (document.readyState === "complete") {
        registerSW();
      } else {
        window.addEventListener("load", registerSW);
        return () => window.removeEventListener("load", registerSW);
      }
    }
  }, []);

  return (
    <SessionProvider>
      <Suspense fallback={null}>
        {children}
      </Suspense>
    </SessionProvider>
  );
}
