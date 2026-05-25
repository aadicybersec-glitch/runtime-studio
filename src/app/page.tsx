import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import Link from "next/link";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1 text-xs text-zinc-400">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          Production-grade metadata-driven runtime
        </div>

        {/* Heading */}
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-semibold text-zinc-100 tracking-tight leading-none">
            AppForge
          </h1>
          <p className="text-xl text-zinc-400 max-w-lg mx-auto leading-relaxed">
            Generate complete applications — forms, tables, APIs, and workflows — from a single JSON configuration.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2">
          {[
            "Dynamic Form Engine",
            "Schema-Aware Tables",
            "CRUD API Generation",
            "Live Config Editor",
            "Workflow Automation",
            "Graceful Degradation",
          ].map((feat) => (
            <span
              key={feat}
              className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-zinc-400"
            >
              {feat}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/auth/register"
            className="px-6 py-2.5 bg-zinc-100 text-zinc-900 text-sm font-medium rounded-md hover:bg-white transition-colors"
          >
            Get started
          </Link>
          <Link
            href="/auth/login"
            className="px-6 py-2.5 bg-transparent text-zinc-300 text-sm border border-zinc-700 rounded-md hover:border-zinc-500 hover:text-zinc-100 transition-colors"
          >
            Sign in
          </Link>
        </div>

        {/* Architecture signal */}
        <div className="pt-8 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {[
            {
              title: "Resilient Runtime",
              body: "Malformed configurations are isolated at the parser level. Invalid components resolve to fallback placeholders — the workspace stays functional.",
            },
            {
              title: "Metadata-Driven",
              body: "Define entities, fields, forms, and tables in JSON. The platform compiles them into a working application at execution time.",
            },
            {
              title: "Workflow Automation",
              body: "Attach automation triggers to record lifecycle events. Workflows execute asynchronously — CRUD operations are never blocked.",
            },
          ].map((card) => (
            <div key={card.title} className="space-y-2">
              <h3 className="text-sm font-semibold text-zinc-200">{card.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
