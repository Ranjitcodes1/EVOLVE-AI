"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import DoodleCrewFooter from "@/components/ui/doodle-crew-footer";

export default function HomePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [navigatingRole, setNavigatingRole] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isStudent = mounted && user?.role === "student";
  const isTeacher = mounted && user?.role === "teacher";

  return (
    <main className="h-screen w-screen max-h-screen overflow-hidden bg-white select-none flex flex-col justify-center relative">
      <DoodleCrewFooter
        wordmark="EVOLVE"
        brand="Evolve"
        tagline="Roll-Call in Seconds. Verified by Faculty."
        blurb=""
        preset="paper"
        height="100vh"
        tracking={0.035}
        showTop={false}
        showBottomBar={false}
      >
        {/* TWO INTERACTIVE CARDS: TEACHER & STUDENT */}
        <div className="max-w-xl sm:max-w-2xl mx-auto w-full z-10 px-3 sm:px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* TEACHER TILE */}
            <Link
              href={isTeacher ? "/teacher" : "/login?role=teacher"}
              prefetch={true}
              onClick={() => setNavigatingRole("teacher")}
              className={`group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-white/95 border-2 border-slate-900 shadow-[3.5px_3.5px_0_#0d0d0d] sm:shadow-[4.5px_4.5px_0_#0d0d0d] hover:shadow-[5.5px_5.5px_0_#ff6b2c] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1.5px_1.5px_0_#0d0d0d] transition-all duration-200 cursor-pointer text-left ${
                navigatingRole === "teacher" ? "opacity-80 ring-2 ring-amber-400" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <span className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-100 border-2 border-slate-900 text-slate-900 text-xl sm:text-2xl shadow-[2px_2px_0_#0d0d0d] group-hover:scale-105 transition-transform">
                  🧑‍🏫
                </span>
                <span className="w-8 h-8 rounded-full border-2 border-slate-900 bg-white flex items-center justify-center text-sm font-black text-slate-900 shadow-[1.5px_1.5px_0_#0d0d0d] group-hover:bg-amber-400 group-hover:translate-x-0.5 transition-all">
                  {navigatingRole === "teacher" ? "⏳" : "→"}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-950 tracking-tight leading-tight group-hover:text-amber-600 transition-colors">
                {navigatingRole === "teacher" ? "Opening Faculty Studio..." : "I'm a Teacher"}
              </h3>
            </Link>

            {/* STUDENT TILE */}
            <Link
              href={isStudent ? "/student" : "/login?role=student"}
              prefetch={true}
              onClick={() => setNavigatingRole("student")}
              className={`group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-white/95 border-2 border-slate-900 shadow-[3.5px_3.5px_0_#0d0d0d] sm:shadow-[4.5px_4.5px_0_#0d0d0d] hover:shadow-[5.5px_5.5px_0_#ff4d4d] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1.5px_1.5px_0_#0d0d0d] transition-all duration-200 cursor-pointer text-left ${
                navigatingRole === "student" ? "opacity-80 ring-2 ring-rose-400" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <span className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-rose-100 border-2 border-slate-900 text-slate-900 text-xl sm:text-2xl shadow-[2px_2px_0_#0d0d0d] group-hover:scale-105 transition-transform">
                  🧑‍🎓
                </span>
                <span className="w-8 h-8 rounded-full border-2 border-slate-900 bg-white flex items-center justify-center text-sm font-black text-slate-900 shadow-[1.5px_1.5px_0_#0d0d0d] group-hover:bg-rose-500 group-hover:text-white group-hover:translate-x-0.5 transition-all">
                  {navigatingRole === "student" ? "⏳" : "→"}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-950 tracking-tight leading-tight group-hover:text-rose-600 transition-colors">
                {navigatingRole === "student" ? "Opening Student Hub..." : "I'm a Student"}
              </h3>
            </Link>
          </div>

          {/* ACTIVE SESSION STATUS & SIGN OUT */}
          {mounted && user && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-slate-700 bg-white/90 backdrop-blur-sm py-1 px-3 rounded-full border border-slate-300 w-fit mx-auto shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Logged in as <strong className="text-slate-950 font-black">{user.name}</strong> ({user.role})
              </span>
              <span className="text-slate-400">·</span>
              <button
                type="button"
                onClick={() => logout()}
                className="text-rose-600 hover:text-rose-800 underline font-black transition cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </DoodleCrewFooter>
    </main>
  );
}
