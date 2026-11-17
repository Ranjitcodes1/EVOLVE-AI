"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Camera, LogOut, User, ShieldCheck, GraduationCap, LayoutDashboard } from "lucide-react";

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keep homepage, login, and registration portals completely immersive and full-bleed without navbar pushing it down
  if (pathname === "/" || pathname === "/login" || pathname === "/register" || pathname === "/teacher/register") {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-slate-900 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="h-8 w-8 rounded-lg bg-amber-100 border-2 border-slate-900 text-slate-900 flex items-center justify-center font-black shadow-[2px_2px_0_#0d0d0d] group-hover:-translate-y-0.5 transition-transform">
            ⚡
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-black tracking-tight text-slate-900 uppercase font-mono">
              EVOLVE
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border-2 border-slate-900 shadow-[1px_1px_0_#0d0d0d]">
              Vision Suite
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-3">
          {mounted && user ? (
            <>
              {user.role === "teacher" && (
                <Link
                  href="/teacher"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                    pathname.startsWith("/teacher")
                      ? "bg-amber-100 text-slate-900 border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d]"
                      : "text-slate-700 hover:text-slate-950"
                  }`}
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Teacher Portal
                </Link>
              )}
              {user.role === "student" && (
                <Link
                  href="/student"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                    pathname.startsWith("/student")
                      ? "bg-rose-100 text-slate-900 border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d]"
                      : "text-slate-700 hover:text-slate-950"
                  }`}
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                  Student Portal
                </Link>
              )}
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                    pathname.startsWith("/admin")
                      ? "bg-indigo-100 text-slate-900 border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d]"
                      : "text-slate-700 hover:text-slate-950"
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Admin Console
                </Link>
              )}

              <div className="h-4 w-px bg-slate-300 mx-1" />

              <div className="flex items-center gap-2.5">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-black text-slate-900 leading-tight">{user.name}</p>
                  <p className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">{user.role}</p>
                </div>
                <button
                  onClick={logout}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-900 hover:bg-rose-100 hover:text-rose-900 border-2 border-slate-900 shadow-[1.5px_1.5px_0_#0d0d0d] transition active:translate-y-0.5"
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-900 hover:bg-slate-100 transition"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-rose-500 hover:bg-rose-600 border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d] transition active:translate-y-0.5"
              >
                Enroll Student
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
