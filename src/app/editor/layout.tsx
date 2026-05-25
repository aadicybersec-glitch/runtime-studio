// src/app/editor/layout.tsx
import React from "react";

// The editor requires user session parsing and database connections, so we exempt it from static build prerenders
export const unstable_instant = false;

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-[#09090b]">{children}</div>;
}
