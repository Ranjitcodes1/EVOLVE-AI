"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, StudentDashboardData, StudentProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import ContributionSkyline, { ContributionDay } from "@/components/ui/contribution-skyline";
import {
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Calendar,
  ShieldCheck,
  Camera,
  ArrowRight,
  Clock,
  Sparkles,
  CalendarDays,
  Check,
  X,
  Layers,
  GraduationCap,
  ChevronRight,
  CheckCircle,
  RefreshCw,
} from "lucide-react";

export default function StudentDashboard() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<StudentDashboardData | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem("snapclass_student_cache");
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  });
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return !sessionStorage.getItem("snapclass_student_cache");
    }
    return true;
  });
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Selected subject for detailed day-by-day heatmap & verified roll-call history
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string | null>(null);
  const [showSimulation, setShowSimulation] = useState(false);

  // Selected lecture detail preview
  const [selectedLecture, setSelectedLecture] = useState<{
    date: string;
    status: string;
    method?: string;
  } | null>(null);

  // AUTH GUARD: If not logged in as student, redirect directly to student sign-in
  useEffect(() => {
    if (!isLoading && (!user || user.role !== "student")) {
      router.replace("/login?role=student");
    }
  }, [user, isLoading, router]);

  const fetchAttendance = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const attendanceRes = await api.getStudentAttendance();
      setData(attendanceRes);
      try {
        sessionStorage.setItem("snapclass_student_cache", JSON.stringify(attendanceRes));
      } catch {}
      setError(null);
    } catch (err: any) {
      if (!data) {
        setError(err.message || "Failed to load student attendance data");
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== "student") return;

    fetchAttendance(true);

    // Auto-refresh every 12 seconds so new faculty subjects and attendance reflect live
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchAttendance(true);
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [user]);

  // Selected subject metadata
  const activeSubjectSummary = useMemo(() => {
    if (!data?.subject_summaries || !selectedSubjectCode) return null;
    return data.subject_summaries.find((s) => s.subject_code === selectedSubjectCode) || null;
  }, [data?.subject_summaries, selectedSubjectCode]);

  // Filter records specifically for the active selected subject
  const activeSubjectRecords = useMemo(() => {
    if (!data?.recent_records || !selectedSubjectCode) return [];
    return data.recent_records
      .filter((r) => r.subject_code === selectedSubjectCode)
      .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime());
  }, [data?.recent_records, selectedSubjectCode]);

  // Format real attendance records into ContributionDay[] for ContributionSkyline
  const skylineData: ContributionDay[] = useMemo(() => {
    if (!activeSubjectRecords || activeSubjectRecords.length === 0) {
      return [];
    }
    const dayMap = new Map<string, { presentCount: number; absentCount: number }>();
    for (const r of activeSubjectRecords) {
      const rawDate = typeof r.session_date === "string"
        ? r.session_date.slice(0, 10)
        : new Date(r.session_date).toISOString().slice(0, 10);
      const isAttended = r.status.toLowerCase() === "present" || r.status.toLowerCase() === "late";
      const current = dayMap.get(rawDate) || { presentCount: 0, absentCount: 0 };
      if (isAttended) {
        current.presentCount += 1;
      } else {
        current.absentCount += 1;
      }
      dayMap.set(rawDate, current);
    }
    return Array.from(dayMap.entries()).map(([date, stat]) => {
      if (stat.presentCount > 0) {
        return { date, count: stat.presentCount, status: "present" as const };
      } else {
        return { date, count: 0, status: "absent" as const };
      }
    });
  }, [activeSubjectRecords]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="p-6 rounded-2xl border-2 border-slate-900 bg-white shadow-[4px_4px_0_#0d0d0d] text-center max-w-sm w-full space-y-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d] flex items-center justify-center mx-auto text-lg font-black animate-bounce text-rose-600">
            ✦
          </div>
          <h3 className="text-base font-black text-slate-900">Loading Student Portal...</h3>
          <p className="text-xs text-slate-500 font-medium">
            Retrieving enrolled subjects, faculty roll-call sessions, and verified attendance.
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="p-6 rounded-2xl border-2 border-slate-900 bg-white shadow-[4px_4px_0_#0d0d0d] text-center max-w-md w-full space-y-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d] flex items-center justify-center mx-auto text-rose-600 font-black">
            ✕
          </div>
          <h3 className="text-base font-black text-slate-900">Failed to Load Profile</h3>
          <p className="text-xs text-rose-600 font-semibold">{error || "Could not retrieve student attendance."}</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-slate-900 bg-white text-xs font-black uppercase tracking-wider text-slate-900 shadow-[2px_2px_0_#0d0d0d] hover:bg-slate-50 transition"
          >
            Return to Sign In →
          </Link>
        </div>
      </div>
    );
  }

  const hasConductedClasses = data.total_classes > 0;
  const isOverallEligible = hasConductedClasses && data.overall_percentage >= 75.0;

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-rose-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* 1. STUDENT IDENTITY HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 sm:p-7 rounded-2xl bg-white border-2 border-slate-900 shadow-[4px_4px_0_#0d0d0d]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border-2 border-slate-900 shadow-[1.5px_1.5px_0_#0d0d0d]">
                Student Academic Portal
              </span>
              <span className="text-[10px] font-bold text-slate-500">
                Academic Session 2026–2027
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {data.full_name}
            </h1>
            <p className="text-xs text-slate-600 font-mono mt-1 font-semibold flex flex-wrap items-center gap-2">
              <span>URN: <strong className="text-slate-900 font-bold">{data.urn}</strong></span>
              <span>•</span>
              <span>Division: <strong className="text-slate-900 font-bold">{data.division_name || profile?.division_name || "A"}</strong></span>
              <span>•</span>
              <span>Semester: <strong className="text-slate-900 font-bold">{data.semester || profile?.semester || 3}</strong></span>
              {(data.roll_number || profile?.roll_number) && (
                <>
                  <span>•</span>
                  <span>Roll No: <strong className="text-slate-900 font-bold">{data.roll_number || profile?.roll_number}</strong></span>
                </>
              )}
            </p>
          </div>

          {/* Clean Smart ID Status (No Internal ML Jargon) */}
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-white border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d] flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 border border-slate-900 text-emerald-800 flex items-center justify-center shadow-[1px_1px_0_#0d0d0d]">
                <ShieldCheck className="h-4 w-4 stroke-[2.5]" />
              </div>
              <div>
                <p className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
                  Smart ID Badge
                </p>
                <p className="text-[10px] text-emerald-700 font-black flex items-center gap-1">
                  <Check className="w-3 h-3 stroke-[3]" /> Face ID Verified
                </p>
              </div>
            </div>

            <Link
              href="/register?mode=update"
              className="p-3 rounded-xl border-2 border-slate-900 bg-white text-slate-900 hover:bg-slate-50 shadow-[2px_2px_0_#0d0d0d] text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition active:translate-y-0.5"
              title="Update reference face portrait & smart ID badge"
            >
              <Camera className="h-3.5 w-3.5 text-rose-500" />
              <span className="hidden sm:inline">Update Photo</span>
            </Link>

            <button
              onClick={() => fetchAttendance(false)}
              disabled={isRefreshing}
              className="p-3 rounded-xl border-2 border-slate-900 bg-white text-slate-900 hover:bg-slate-50 shadow-[2px_2px_0_#0d0d0d] text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition active:translate-y-0.5"
              title="Refresh courses and attendance"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-blue-600 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{isRefreshing ? "Syncing..." : "Refresh"}</span>
            </button>

            <button
              onClick={() => logout("/login?role=student")}
              className="p-3 rounded-xl border-2 border-slate-900 bg-white text-rose-700 hover:bg-rose-50 shadow-[2px_2px_0_#0d0d0d] text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition active:translate-y-0.5"
              title="Sign out of student account"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* 2. OVERALL ACADEMIC SUMMARY METRICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Overall Attendance Rate */}
          <div className="p-5 rounded-2xl bg-white border-2 border-slate-900 shadow-[3px_3px_0_#0d0d0d] flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Overall Attendance
            </span>
            <div className="my-2">
              <span className={`text-4xl font-black tracking-tight ${
                !hasConductedClasses
                  ? "text-slate-400"
                  : isOverallEligible
                  ? "text-emerald-600"
                  : "text-rose-600"
              }`}>
                {hasConductedClasses ? `${data.overall_percentage}%` : "—"}
              </span>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                {hasConductedClasses ? `${data.attended_classes} of ${data.total_classes} Classes Attended` : "No classes conducted yet"}
              </p>
            </div>
            <div>
              {!hasConductedClasses ? (
                <span className="inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                  Semester In Progress
                </span>
              ) : isOverallEligible ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Eligible for Exams (&ge; 75%)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300">
                  <AlertTriangle className="w-3 h-3 text-rose-700" /> Attendance Shortage (&lt; 75%)
                </span>
              )}
            </div>
          </div>

          {/* Enrolled Courses */}
          <div className="p-5 rounded-2xl bg-white border-2 border-slate-900 shadow-[3px_3px_0_#0d0d0d] flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Enrolled Courses
            </span>
            <div className="my-2">
              <span className="text-4xl font-black tracking-tight text-slate-900">
                {data.subject_summaries.length}
              </span>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                Division {profile?.division_name || "A"} • Semester {profile?.semester || 3}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 w-fit">
              <BookOpen className="w-3 h-3 text-slate-600" /> Core Curriculum
            </span>
          </div>

          {/* Classes Attended */}
          <div className="p-5 rounded-2xl bg-white border-2 border-slate-900 shadow-[3px_3px_0_#0d0d0d] flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Total Present / Late
            </span>
            <div className="my-2">
              <span className="text-4xl font-black tracking-tight text-emerald-600">
                {data.attended_classes}
              </span>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                Verified Roll-Call Matches
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 w-fit">
              <Check className="w-3 h-3 text-emerald-700 stroke-[3]" /> Camera Roll-Call Confirmed
            </span>
          </div>

          {/* Classes Missed */}
          <div className="p-5 rounded-2xl bg-white border-2 border-slate-900 shadow-[3px_3px_0_#0d0d0d] flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Total Absences
            </span>
            <div className="my-2">
              <span className={`text-4xl font-black tracking-tight ${
                data.total_classes - data.attended_classes > 0 ? "text-rose-600" : "text-slate-400"
              }`}>
                {data.total_classes - data.attended_classes}
              </span>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                Missed Lectures Across Subjects
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 w-fit">
              <Clock className="w-3 h-3 text-slate-500" /> Audited by Faculty
            </span>
          </div>
        </div>

        {/* 3. SUBJECT-WISE BREAKDOWN CARDS (CLICK TO OPEN HEATMAP) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-rose-600 stroke-[2.5]" />
                Subject-Wise Attendance Breakdown
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Click any subject card below to view its daily attendance heatmap and lecture verification log.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {data.subject_summaries.length} Courses
            </span>
          </div>

          {data.subject_summaries.length === 0 ? (
            <div className="p-8 sm:p-10 rounded-2xl bg-white border-2 border-slate-900 text-center shadow-[3.5px_3.5px_0_#0d0d0d] space-y-2">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border-2 border-slate-900 text-slate-900 flex items-center justify-center mx-auto text-base font-black shadow-[2px_2px_0_#0d0d0d]">
                ✦
              </div>
              <h3 className="text-sm font-black text-slate-900">No Active Faculty Courses Assigned Yet</h3>
              <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                Your professors have not yet assigned courses to Division {profile?.division_name || "B"}. As soon as a teacher adds your division to their teaching portfolio, the course will appear here with its 3D attendance skyline.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.subject_summaries.map((sub) => {
                const isSelected = selectedSubjectCode === sub.subject_code;
                const subHasClasses = sub.total_classes > 0;
                const subEligible = subHasClasses && sub.attendance_percentage >= 75.0;

                return (
                  <button
                    key={sub.subject_code}
                    type="button"
                    onClick={() => {
                      if (selectedSubjectCode === sub.subject_code) {
                        setSelectedSubjectCode(null);
                      } else {
                        setSelectedSubjectCode(sub.subject_code);
                      }
                      setSelectedLecture(null);
                    }}
                    className={`text-left p-5 rounded-2xl border-2 transition-all duration-150 flex flex-col justify-between ${
                      isSelected
                        ? "bg-rose-50/80 border-slate-900 shadow-[4px_4px_0_#ff4d4d] -translate-y-0.5"
                        : "bg-white border-slate-900 shadow-[3px_3px_0_#0d0d0d] hover:shadow-[4px_4px_0_#0d0d0d] hover:-translate-y-0.5"
                    }`}
                  >
                    <div>
                      {/* Top Row: Code & Percentage */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-white border border-slate-900 text-slate-950 shadow-[1px_1px_0_#0d0d0d]">
                          {sub.subject_code}
                        </span>
                        <span className={`text-base font-black ${
                          !subHasClasses
                            ? "text-slate-400"
                            : subEligible
                            ? "text-emerald-700"
                            : "text-rose-600"
                        }`}>
                          {subHasClasses ? `${sub.attendance_percentage}%` : "—"}
                        </span>
                      </div>

                      {/* Subject Name */}
                      <h3 className="font-black text-slate-900 text-sm leading-snug">
                        {sub.subject_name}
                      </h3>

                      {/* Subject-Wise Attendance Breakdown */}
                      <div className="mt-3 pt-2.5 border-t border-slate-200/80 grid grid-cols-3 gap-1 text-center">
                        <div className="bg-emerald-50 rounded-lg py-1 border border-emerald-200">
                          <p className="text-[9px] font-black uppercase text-emerald-800">Present</p>
                          <p className="text-xs font-black text-emerald-700">{sub.attended_classes}</p>
                        </div>
                        <div className="bg-rose-50 rounded-lg py-1 border border-rose-200">
                          <p className="text-[9px] font-black uppercase text-rose-800">Absent</p>
                          <p className="text-xs font-black text-rose-700">{sub.total_classes - sub.attended_classes}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg py-1 border border-slate-200">
                          <p className="text-[9px] font-black uppercase text-slate-700">Total</p>
                          <p className="text-xs font-black text-slate-800">{sub.total_classes}</p>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action / Selection Indicator */}
                    <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        !subHasClasses
                          ? "bg-slate-100 text-slate-600 border-slate-300"
                          : subEligible
                          ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                          : "bg-rose-100 text-rose-900 border-rose-300"
                      }`}>
                        {!subHasClasses
                          ? "No Classes Yet"
                          : subEligible
                          ? "✓ On Track (≥ 75%)"
                          : "⚠ Shortage (< 75%)"}
                      </span>

                      <span className={`text-[11px] font-black flex items-center gap-0.5 ${
                        isSelected ? "text-rose-600" : "text-slate-500"
                      }`}>
                        {isSelected ? "Viewing Heatmap ▼" : "View Heatmap →"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. SELECTED SUBJECT'S 3D / 2D ATTENDANCE SKYLINE & SESSION LOG */}
        {activeSubjectSummary && (
          <div className="bg-white rounded-2xl border-2 border-slate-900 p-6 sm:p-7 shadow-[4px_4px_0_#0d0d0d] space-y-6 animate-in fade-in duration-200">
            {/* Header with Title, Stats & Close Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b-2 border-slate-900 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-rose-100 border-2 border-slate-900 shadow-[1px_1px_0_#0d0d0d]">
                    <CalendarDays className="h-4 w-4 text-rose-700 stroke-[2.5]" />
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    {activeSubjectSummary.subject_code} • {activeSubjectSummary.subject_name}
                  </h2>
                </div>
                <p className="text-xs text-slate-600 font-medium mt-1">
                  Day-by-day attendance heat map with 3D isometric skyline projection & camera audit log.
                </p>
              </div>

              {/* Action Buttons: Preview Toggle & Close */}
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowSimulation((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-xl border-2 border-slate-900 text-xs font-black uppercase tracking-wider shadow-[2px_2px_0_#0d0d0d] transition active:translate-y-0.5 ${
                    showSimulation
                      ? "bg-amber-300 text-slate-950"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  title="Toggle between real attendance records and simulated full academic term preview"
                >
                  {showSimulation ? "✦ Showing 3D Simulation" : "Preview 3D Year Simulation"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubjectCode(null);
                    setSelectedLecture(null);
                  }}
                  className="px-3 py-1.5 rounded-xl border-2 border-slate-900 bg-rose-100 hover:bg-rose-200 text-rose-900 shadow-[2px_2px_0_#0d0d0d] text-xs font-black uppercase tracking-wider flex items-center gap-1 transition active:translate-y-0.5"
                  title="Collapse and hide heatmap"
                >
                  <X className="w-3.5 h-3.5 stroke-[3]" /> Close Heatmap
                </button>
              </div>
            </div>

            {/* THE ISOMETRIC ATTENDANCE SKYLINE COMPONENT */}
            <div className="w-full">
              <ContributionSkyline
                data={showSimulation ? undefined : skylineData}
                unit="lecture"
                unitPlural="lectures"
                palette="github"
                defaultView="3d"
                orbit={true}
                title={
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900">
                      {activeSubjectSummary.subject_code}: {activeSubjectSummary.subject_name}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold font-mono">
                      {showSimulation
                        ? "Simulation Mode"
                        : `${activeSubjectSummary.attended_classes} of ${activeSubjectSummary.total_classes} Attended (${activeSubjectSummary.attendance_percentage}%)`}
                    </span>
                  </div>
                }
                onCellClick={(day) => {
                  const rec = activeSubjectRecords.find(
                    (r) => (typeof r.session_date === "string" ? r.session_date.slice(0, 10) : "") === day.date
                  );
                  if (rec) {
                    setSelectedLecture({
                      date: rec.session_date,
                      status: rec.status,
                      method: rec.marking_method,
                    });
                  }
                }}
              />
            </div>

            {/* Selected Lecture Details Callout (If a cell is clicked) */}
            {selectedLecture && (
              <div className="p-3.5 rounded-xl bg-slate-100 border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d] text-xs flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono font-black text-slate-900 text-sm">{selectedLecture.date}</span>
                  <span>•</span>
                  <span className={`font-black uppercase px-2.5 py-0.5 rounded-full border text-[10px] ${
                    selectedLecture.status === "present"
                      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                      : selectedLecture.status === "late"
                      ? "bg-amber-100 text-amber-900 border-amber-300"
                      : "bg-rose-100 text-rose-900 border-rose-300"
                  }`}>
                    {selectedLecture.status}
                  </span>
                  <span>•</span>
                  <span className="text-slate-600 font-bold">
                    Classroom Camera Roll-Call (Audited & Locked by Faculty)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLecture(null)}
                  className="text-slate-500 hover:text-slate-900 font-black text-sm px-1.5"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Chronological Lecture History List */}
            {activeSubjectRecords.length > 0 ? (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Verified Session Audit Log ({activeSubjectRecords.length} Sessions)
                  </h3>
                  <span className="text-[11px] font-bold text-slate-500">
                    Showing latest verified roll-call records
                  </span>
                </div>
                <div className="border-2 border-slate-900 rounded-xl overflow-hidden shadow-[2px_2px_0_#0d0d0d]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b-2 border-slate-900 text-[10px] font-black text-slate-700 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Lecture Date</th>
                        <th className="py-2.5 px-3">Attendance Status</th>
                        <th className="py-2.5 px-3">Verification Source</th>
                        <th className="py-2.5 px-3 text-right">Faculty Audit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-slate-200 font-semibold">
                      {activeSubjectRecords.map((rec) => {
                        const d = new Date(rec.session_date);
                        const dateFmt = d.toLocaleDateString("en-US", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        });
                        const isPresent = rec.status === "present";
                        const isLate = rec.status === "late";

                        return (
                          <tr key={rec.session_id} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              {dateFmt}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                isPresent
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                  : isLate
                                  ? "bg-amber-100 text-amber-900 border-amber-300"
                                  : "bg-rose-100 text-rose-900 border-rose-300"
                              }`}>
                                {isPresent && "✓ Present"}
                                {isLate && "⏱ Late"}
                                {!isPresent && !isLate && "✕ Absent"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                              {rec.marking_method === "ai_proposed"
                                ? "Classroom Camera Roll-Call"
                                : "Faculty Direct Roll-Call"}
                            </td>
                            <td className="py-2.5 px-3 text-right text-emerald-700 font-bold text-[11px]">
                              ✓ Audited & Locked
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 text-center text-xs text-slate-500 font-medium">
                No individual lecture sessions recorded yet for this course. Once your teacher conducts attendance, verified records will appear in the table and elevate the 3D skyline bars!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
