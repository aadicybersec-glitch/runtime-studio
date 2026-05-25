"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, AlertCircle, Loader2 } from "lucide-react";
import logger from "@/lib/logger/logger";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    setError(null);
    logger.info("Auth", `Attempting credentials sign-in for email: ${values.email}`);

    try {
      const res = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (res?.error) {
        logger.warn("Auth", `Sign-in failed for user ${values.email}: ${res.error}`);
        setError("Invalid email or password. Please try again.");
      } else {
        logger.info("Auth", `Sign-in successful for user ${values.email}`);
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      logger.error("Auth", "Unexpected error during credentials sign-in", { error: err.message });
      setError("An unexpected error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = (provider: "github" | "google") => {
    logger.info("Auth", `Initiating OAuth sign-in for provider: ${provider}`);
    signIn(provider, { callbackUrl: "/dashboard" });
  };

  return (
    <div className="w-full max-w-md space-y-8">
      {/* Title Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-100 bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
          AppForge
        </h1>
        <p className="text-sm text-zinc-400">
          Sign in to your metadata-driven workspace
        </p>
      </div>

      {/* Main card */}
      <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-8 shadow-2xl space-y-6">
        {error && (
          <div className="flex items-center gap-3 p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-xs text-red-400 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400" htmlFor="email">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
                disabled={isLoading}
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-xxs text-red-400 mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Password input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-zinc-400" htmlFor="password">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
                disabled={isLoading}
                {...register("password")}
              />
            </div>
            {errors.password && (
              <p className="text-xxs text-red-400 mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 bg-zinc-100 hover:bg-white text-zinc-900 font-medium rounded-lg text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center justify-center py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800/80"></div>
          </div>
          <span className="relative px-3 bg-[#111113] text-xxs text-zinc-500 uppercase tracking-widest">
            or continue with
          </span>
        </div>

        {/* OAuth Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleOAuthSignIn("google")}
            className="flex items-center justify-center gap-2 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-6.887 4.114-4.833 0-8.75-3.77-8.75-8.514s3.917-8.514 8.75-8.514c2.445 0 4.417.892 5.897 2.296L19.26 2.09C17.295.394 14.773 0 12.24 0 5.58 0 0 5.373 0 12s5.58 12 12.24 12c6.26 0 11.24-4.323 11.24-11.29 0-.648-.057-1.185-.18-1.714H12.24Z" />
            </svg>
            Google
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleOAuthSignIn("github")}
            className="flex items-center justify-center gap-2 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.577v-2.234c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.82 1.102.82 2.222v3.293c0 .319.22.694.825.576C20.565 21.795 24 17.3 24 12c0-6.63-5.37-12-12-12Z" />
            </svg>
            GitHub
          </button>
        </div>
      </div>

      {/* Footer link */}
      <p className="text-center text-xs text-zinc-500">
        Don&apos;t have an account?{" "}
        <Link
          href="/auth/register"
          className="text-zinc-300 hover:underline hover:text-white font-medium transition-colors"
        >
          Create one now
        </Link>
      </p>
    </div>
  );
}
