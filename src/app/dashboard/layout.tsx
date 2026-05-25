// src/app/dashboard/layout.tsx
import React from "react";

// Dashboard holds cookie-dependent auth sessions, so we opt out of build-time instant prerender validation
export const unstable_instant = false;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-[#09090b]">{children}</div>;
}
