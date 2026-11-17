"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Lock, Mail, AlertCircle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center font-bold text-slate-500">Loading sign in...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");

  const { user, login, logout, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // AUTO-REDIRECT & AUTO-SESSION CLEAR GUARD
  useEffect(() => {
    if (user) {
      if (!roleParam || user.role === roleParam) {
        if (user.role === "student") {
          router.replace("/student");
        } else if (user.role === "teacher") {
          router.replace("/teacher");
        } else if (user.role === "admin") {
          router.replace("/admin");
        }
      } else if (roleParam && user.role !== roleParam) {
        // Optimised cross-portal switch: If entering sign-in for a different role,
        // silently clear the previous role session so the form is 100% clean.
        logout(null);
      }
    }
  }, [user, router, roleParam, logout]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please verify your institutional credentials.");
    }
  };

  const isTeacher = roleParam === "teacher";
  const isStudent = roleParam === "student";
  const isAdmin = roleParam === "admin";

  return (
    <main className="h-screen w-screen max-h-screen overflow-hidden bg-white select-none flex flex-col justify-between">
      {/* 1. TOP HEADER WITH EVOLVE BRAND */}
      <header className="w-full h-13 sm:h-14 border-b-2 border-slate-900 bg-white px-4 sm:px-6 flex items-center justify-between z-20 shrink-0">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-900 font-extrabold text-xs sm:text-sm hover:opacity-80 transition group"
        >
          <span className="w-7 h-7 rounded-lg border-2 border-slate-900 bg-amber-100 flex items-center justify-center text-xs font-black shadow-[2px_2px_0_#0d0d0d] group-hover:-translate-x-0.5 transition-transform">
            ←
          </span>
          <span className="hidden sm:inline">Home</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter uppercase font-mono">
            EVOLVE
          </span>
          <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-slate-900 border-2 border-slate-900 shadow-[1.5px_1.5px_0_#0d0d0d]">
            Sign In
          </span>
        </div>

        {isTeacher ? (
          <Link
            href="/teacher/register"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-slate-900 bg-amber-400 text-slate-950 text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-[2px_2px_0_#0d0d0d] hover:bg-amber-300 transition active:translate-y-0.5"
          >
            <span>Create Faculty Badge</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        ) : (
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-slate-900 bg-rose-500 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-[2px_2px_0_#0d0d0d] hover:bg-rose-600 transition active:translate-y-0.5"
          >
            <span>Create Student Badge</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </header>

      {/* 2. SIGN IN CARD CONTAINER */}
      <section className="flex-1 w-full max-w-md mx-auto px-4 py-2 flex items-center justify-center overflow-hidden">
        <div className="w-full bg-white rounded-2xl border-2 border-slate-900 shadow-[4.5px_4.5px_0_#0d0d0d] p-6 sm:p-7">
          <div className="text-center mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border-2 border-slate-900 text-slate-900 flex items-center justify-center mx-auto mb-2 text-base font-black shadow-[2px_2px_0_#0d0d0d]">
              ⚡
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {isTeacher
                ? "Faculty Member Sign In"
                : isStudent
                ? "Student Portal Sign In"
                : isAdmin
                ? "System Administration Sign In"
                : "Institutional Sign In"}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {isTeacher
                ? "Access your roll-call studio, verified sessions, and defaulter reports."
                : isStudent
                ? "Access your subject attendance report, heatmaps, and exam eligibility."
                : isAdmin
                ? "Access immutable audit logs and institutional data compliance ledgers."
                : "Enter your institutional credentials to access the academic platform."}
            </p>
          </div>


          {error && (
            <div className="mb-4 p-2.5 rounded-xl bg-red-100 border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d] text-slate-900 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 font-bold" />
              <span className="font-bold">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                Institutional Email
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 absolute left-3 top-2.5 text-slate-700 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    isTeacher
                      ? "faculty@university.edu"
                      : isStudent
                      ? "student@university.edu"
                      : "admin@university.edu"
                  }
                  className="w-full pl-9 pr-3 py-2 text-sm font-bold text-slate-950 placeholder:text-slate-400 placeholder:font-normal rounded-xl border-2 border-slate-900 bg-white shadow-[1.5px_1.5px_0_#0d0d0d] focus:bg-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 absolute left-3 top-2.5 text-slate-700 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm font-bold text-slate-950 placeholder:text-slate-400 placeholder:font-normal rounded-xl border-2 border-slate-900 bg-white shadow-[1.5px_1.5px_0_#0d0d0d] focus:bg-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider transition shadow-[2.5px_2.5px_0_#0d0d0d] active:translate-y-0.5 disabled:opacity-50"
            >
              {isLoading ? "Signing in..." : "Sign In to Portal →"}
            </button>
          </form>

          {/* Institutional Switcher & Registration Links */}
          <div className="mt-4 pt-3.5 border-t border-slate-200 flex flex-col gap-2 text-xs">
            {isTeacher ? (
              <>
                <Link
                  href="/teacher/register"
                  className="text-amber-800 hover:text-amber-950 font-black text-[11px] underline decoration-amber-500 text-center"
                >
                  Don&apos;t have a Faculty ID? Create Faculty Account &rarr;
                </Link>
                <Link
                  href="/login?role=student"
                  className="text-slate-500 hover:text-slate-800 text-[10px] font-bold text-center underline decoration-slate-300"
                >
                  Switch to Student Sign In &rarr;
                </Link>
              </>
            ) : isStudent ? (
              <>
                <Link
                  href="/register"
                  className="text-rose-700 hover:text-rose-900 font-black text-[11px] underline decoration-rose-500 text-center"
                >
                  Don&apos;t have a Student ID? Create Student Account &rarr;
                </Link>
                <Link
                  href="/login?role=teacher"
                  className="text-slate-500 hover:text-slate-800 text-[10px] font-bold text-center underline decoration-slate-300"
                >
                  Switch to Faculty Sign In &rarr;
                </Link>
              </>
            ) : (
              <div className="flex justify-between text-[11px] font-black text-slate-700">
                <Link href="/register" className="hover:underline">Student Registration &rarr;</Link>
                <Link href="/teacher/register" className="hover:underline">Faculty Registration &rarr;</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. STATIC BOTTOM FOOTER BAR */}
      <footer className="w-full h-7 border-t-2 border-slate-900 bg-white px-4 sm:px-6 flex items-center justify-between text-[11px] font-extrabold text-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
          <span>EVOLVE Sign In Gateway</span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-slate-500 font-bold text-[10px]">
          <span>Institutional Access</span>
          <span>•</span>
          <Link href="/login?role=admin" className="hover:text-indigo-600 underline">
            Auditor &amp; Admin Console
          </Link>
        </div>
        <div>
          <span>Evolve.ai Vision Suite © 2026</span>
        </div>
      </footer>
    </main>
  );
}
