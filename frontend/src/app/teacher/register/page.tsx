"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { TeacherIdCardForm, TeacherCardData, TeacherCardValidity } from "@/components/ui/teacher-id-card-form";

export default function RegisterTeacherPage() {
  const router = useRouter();
  const { user, login, logout } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // AUTO-REDIRECT GUARD: If teacher is already logged in, redirect directly to faculty studio
  // If another role is active, clear it so faculty registration is completely clean
  useEffect(() => {
    if (user && user.role === "teacher") {
      router.replace("/teacher");
    } else if (user && user.role !== "teacher") {
      logout(null);
    }
  }, [user, router, logout]);

  const handleCardSubmit = async (data: TeacherCardData, validity: TeacherCardValidity) => {
    if (!validity.allValid) {
      setError("Please complete all required fields on the faculty badge.");
      return;
    }
    setLoading(true);
    setError(null);

    const payload = {
      email: data.email,
      password: data.pin,
      faculty_id: data.facultyId,
      full_name: data.fullName,
      department_name: data.department,
      designation: data.designation,
      course_name: data.course,
      branch_code: data.branchCode,
      subject_code: data.subjectCode,
      subject_name: data.subjectName,
      division_name: data.division,
      semester: data.semester,
      academic_year: data.academicYear,
    };

    try {
      await api.registerTeacher(payload);
      setSuccess("Faculty ID badge generated! Logging in to studio...");
      await login(payload.email, payload.password);
      router.push("/teacher");
    } catch (err: any) {
      setError(err.message || "Failed to register faculty profile. Please verify unique Employee ID / Email.");
    } finally {
      setLoading(false);
    }
  };

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

        {/* Center: Prominent EVOLVE Wordmark + Portal Badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter uppercase font-mono">
            EVOLVE
          </span>
          <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-slate-900 border-2 border-slate-900 shadow-[1.5px_1.5px_0_#0d0d0d]">
            Faculty Portal
          </span>
        </div>

        {/* Right: Sign in link */}
        <Link
          href="/login?role=teacher"
          className="text-[10px] sm:text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border-2 border-slate-900 bg-white hover:bg-slate-100 shadow-[1.5px_1.5px_0_#0d0d0d] text-slate-900 transition"
        >
          Sign In If Registered &rarr;
        </Link>
      </header>

      {/* Floating Alert Banners */}
      {error && (
        <div className="absolute top-15 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4">
          <div className="p-2.5 rounded-xl bg-red-100 border-2 border-slate-900 shadow-[3px_3px_0_#0d0d0d] text-slate-900 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 font-bold" />
              <span className="font-bold">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs font-black px-1.5 py-0.5 rounded hover:bg-red-200 text-red-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="absolute top-15 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4">
          <div className="p-2.5 rounded-xl bg-emerald-100 border-2 border-slate-900 shadow-[3px_3px_0_#0d0d0d] text-slate-900 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 font-bold" />
            <span className="font-bold">{success}</span>
          </div>
        </div>
      )}

      {/* 2. MAIN STATIC STAGE (ZERO-SCROLL) */}
      <section className="flex-1 w-full max-w-5xl mx-auto px-4 py-2 flex items-center justify-center overflow-hidden">
        <TeacherIdCardForm
          defaultValues={{
            institution: "",
            facultyId: "",
            fullName: "",
            course: "",
            branchCode: "",
            subjectCode: "",
            subjectName: "",
            division: "",
            semester: 3,
            academicYear: "2026-2027",
            email: "",
            pin: "",
          }}
          isLoading={loading}
          submitLabel="Save Faculty Badge & Launch Studio →"
          onSubmit={handleCardSubmit}
        />
      </section>

      {/* 3. STATIC BOTTOM FOOTER BAR */}
      <footer className="w-full h-7 border-t-2 border-slate-900 bg-white px-4 sm:px-6 flex items-center justify-between text-[11px] font-extrabold text-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse" />
          <span>EVOLVE Faculty Portal</span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-slate-500 font-bold text-[10px]">
          <span>Role-Based Faculty Access</span>
          <span>•</span>
          <span>Classroom ArcFace Studio</span>
        </div>
        <div>
          <span>Evolve.ai Vision Suite © 2026</span>
        </div>
      </footer>
    </main>
  );
}

