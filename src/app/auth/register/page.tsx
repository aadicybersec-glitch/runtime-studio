"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import logger from "@/lib/logger/logger";

const registerSchema = z.object({
  name: z.string().optional(),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    logger.info("Auth", `Attempting registration for email: ${values.email}`);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        logger.warn("Auth", `Registration failed for ${values.email}: ${data.error}`);
        setError(data.error || "Failed to create account. Please try again.");
      } else {
        logger.info("Auth", `Registration successful for ${values.email}`);
        setSuccess("Account successfully created! Redirecting to login...");
        setTimeout(() => {
          router.push("/auth/login");
        }, 1500);
      }
    } catch (err: any) {
      logger.error("Auth", "Unexpected error during registration", { error: err.message });
      setError("An unexpected error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-8">
      {/* Title Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-100 bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
          Create Account
        </h1>
        <p className="text-sm text-zinc-400">
          Build and deploy applications instantly
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

        {success && (
          <div className="flex items-center gap-3 p-3 bg-emerald-950/40 border border-emerald-900/50 rounded-lg text-xs text-emerald-400 animate-fadeIn">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name input (optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400" htmlFor="name">
              Full Name (Optional)
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
              <input
                id="name"
                type="text"
                placeholder="Jane Doe"
                className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
                disabled={isLoading}
                {...register("name")}
              />
            </div>
            {errors.name && (
              <p className="text-xxs text-red-400 mt-1">{errors.name.message}</p>
            )}
          </div>

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
                disabled={isLoading || !!success}
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-xxs text-red-400 mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Password input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
              <input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
                disabled={isLoading || !!success}
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
            disabled={isLoading || !!success}
            className="w-full py-2 bg-zinc-100 hover:bg-white text-zinc-900 font-medium rounded-lg text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Registering...
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>
      </div>

      {/* Footer link */}
      <p className="text-center text-xs text-zinc-500">
        Already have an account?{" "}
        <Link
          href="/auth/login"
          className="text-zinc-300 hover:underline hover:text-white font-medium transition-colors"
        >
          Sign in here
        </Link>
      </p>
    </div>
  );
}
