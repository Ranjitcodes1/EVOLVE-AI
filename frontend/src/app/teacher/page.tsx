"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  Camera,
  BookOpen,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Layers,
  AlertTriangle,
  Download,
  Search,
  FileSpreadsheet,
  ShieldAlert,
  Plus,
  X,
  Trash2,
} from "lucide-react";
import {
  api,
  TeacherOffering,
  AttendanceSessionSummary,
  OfferingRosterResponse,
} from "@/lib/api";

export default function TeacherDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [offerings, setOfferings] = useState<TeacherOffering[]>([]);
  const [recentSessions, setRecentSessions] = useState<AttendanceSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Class Roster & At-Risk Supervision State
  const [selectedOfferingId, setSelectedOfferingId] = useState<string | null>(null);
  const [rosterData, setRosterData] = useState<OfferingRosterResponse | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterFilter, setRosterFilter] = useState<"all" | "at_risk" | "on_track">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Quick Offering / Division Batch Addition Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newOfferingData, setNewOfferingData] = useState({
    course_name: "Computer Science & Engineering",
    branch_code: "CSE",
    subject_code: "",
    subject_name: "",
    division_name: "",
    semester: 3,
    academic_year: "2026-2027",
  });

  // AUTH GUARD: If not logged in as teacher, redirect directly to faculty sign-in
  useEffect(() => {
    if (!isLoading && (!user || user.role !== "teacher")) {
      router.replace("/login?role=teacher");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user || user.role !== "teacher") return;

    async function loadData() {
      try {
        const [offRes, sessRes] = await Promise.all([
          api.getTeacherOfferings(),
          api.getTeacherRecentSessions(),
        ]);
        setOfferings(offRes);
        setRecentSessions(sessRes);
        if (offRes.length > 0) {
          setSelectedOfferingId(offRes[0].offering_id);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load teacher dashboard data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleCreateOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOfferingData.subject_code.trim() || !newOfferingData.subject_name.trim() || !newOfferingData.division_name.trim()) {
      setAddError("Please provide Subject Code, Subject Name, and Division / Batch.");
      return;
    }
    setAddLoading(true);
    setAddError(null);
    try {
      const created = await api.createCustomOffering({
        course_name: newOfferingData.course_name,
        branch_code: newOfferingData.branch_code,
        subject_code: newOfferingData.subject_code.trim().toUpperCase(),
        subject_name: newOfferingData.subject_name.trim(),
        division_name: newOfferingData.division_name.trim().toUpperCase(),
        semester: Number(newOfferingData.semester),
        academic_year: newOfferingData.academic_year,
      });
      setOfferings((prev) => [created, ...prev]);
      if (!selectedOfferingId) {
        setSelectedOfferingId(created.offering_id);
      }
      setShowAddModal(false);
      setNewOfferingData({
        course_name: "Computer Science & Engineering",
        branch_code: "CSE",
        subject_code: "",
        subject_name: "",
        division_name: "",
        semester: 3,
        academic_year: "2026-2027",
      });
    } catch (err: any) {
      setAddError(err.message || "Failed to add academic offering");
    } finally {
      setAddLoading(false);
    }
  };

  const [removingId, setRemovingId] = useState<string | null>(null);
  const handleRemoveOffering = async (offeringId: string, code: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${code} - ${name}" from your active teaching portfolio?`)) {
      return;
    }
    setRemovingId(offeringId);
    try {
      await api.removeTeacherOffering(offeringId);
      setOfferings((prev) => {
        const remaining = prev.filter((o) => o.offering_id !== offeringId);
        if (selectedOfferingId === offeringId) {
          setSelectedOfferingId(remaining.length > 0 ? remaining[0].offering_id : null);
        }
        return remaining;
      });
    } catch (err: any) {
      alert(err.message || "Failed to remove offering");
    } finally {
      setRemovingId(null);
    }
  };

  // Fetch student roster when active offering changes
  useEffect(() => {
    if (!selectedOfferingId) return;
    async function loadRoster() {
      try {
        setRosterLoading(true);
        const data = await api.getOfferingRoster(selectedOfferingId!);
        setRosterData(data);
      } catch (err: any) {
        console.warn("Failed to load offering roster", err);
      } finally {
        setRosterLoading(false);
      }
    }
    loadRoster();
  }, [selectedOfferingId]);

  // Export CSV of Defaulters (< 75%)
  const handleExportDefaulters = () => {
    if (!rosterData) return;
    const defaulters = rosterData.students.filter((s) => s.is_at_risk);
    if (defaulters.length === 0) {
      if (rosterData.total_classes_held === 0) {
        alert("No attendance sessions have been conducted yet for this semester.");
      } else {
        alert("No defaulters found! All enrolled students have attendance ≥ 75%.");
      }
      return;
    }
    const headers = [
      "URN",
      "Student Name",
      "Roll Number",
      "Classes Attended",
      "Total Classes Held",
      "Attendance Percentage",
      "Status",
    ];
    const rows = defaulters.map((s) => [
      s.urn,
      `"${s.full_name}"`,
      s.roll_number,
      s.attended_classes,
      s.total_classes,
      `${s.attendance_percentage}%`,
      "At Risk (< 75%)",
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Defaulters_${rosterData.subject_code}_Div_${rosterData.division_name}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredStudents = (rosterData?.students || []).filter((s) => {
    if (rosterFilter === "at_risk" && !s.is_at_risk) return false;
    if (rosterFilter === "on_track" && s.is_at_risk) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.urn.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="p-6 rounded-2xl border-2 border-slate-900 bg-white shadow-[4px_4px_0_#0d0d0d] text-center max-w-sm w-full space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d] flex items-center justify-center mx-auto text-lg font-black animate-bounce">
            ⚡
          </div>
          <h3 className="text-base font-black text-slate-900">Loading Faculty Studio...</h3>
          <p className="text-xs text-slate-500 font-medium">
            Fetching assigned courses, division rosters, and confirmed roll-call sessions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-amber-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
        {/* 1. Welcome Banner Card */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 sm:p-7 rounded-2xl bg-white border-2 border-slate-900 shadow-[4px_4px_0_#0d0d0d]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-slate-900 border-2 border-slate-900 shadow-[1.5px_1.5px_0_#0d0d0d]">
                Faculty Portal
              </span>
              <span className="text-[10px] font-bold text-slate-500">
                Academic Session 2026–2027
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Welcome, {user?.name || "Professor"}
            </h1>
            <p className="text-xs text-slate-600 font-medium mt-1">
              Department of Computer Science & Engineering • Multi-Camera Roll-Call Studio
            </p>
          </div>

          <div>
            <Link
              href="/teacher/session/new"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider border-2 border-slate-900 shadow-[3px_3px_0_#0d0d0d] transition active:translate-y-0.5"
            >
              <Camera className="h-4 w-4" />
              <span>Take Classroom Attendance</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-100 border-2 border-slate-900 shadow-[3px_3px_0_#0d0d0d] text-red-900 text-xs font-bold">
            {error}
          </div>
        )}

        {/* 2. Grid: Assigned Classes (Left) & Recent Sessions (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
          {/* Left: Assigned Academic Offerings (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-600 stroke-[2.5]" />
                Assigned Courses & Division Batches
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500">
                  {offerings.length} Active Offerings
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="px-3 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d] flex items-center gap-1.5 transition active:translate-y-0.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Class / Batch</span>
                </button>
              </div>
            </div>

            {/* Quick Add Offering Modal */}
            {showAddModal && (
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border-2 border-slate-900 shadow-[3px_3px_0_#0d0d0d] space-y-3">
                <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-200 border border-slate-900 flex items-center justify-center text-xs font-black">
                      +
                    </span>
                    <h3 className="text-sm font-black text-slate-900">
                      Assign New Course, Division, or Batch
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setAddError(null);
                    }}
                    className="w-6 h-6 rounded-lg bg-white border border-slate-900 flex items-center justify-center text-xs font-black text-slate-700 hover:bg-rose-100 hover:text-rose-800 transition"
                  >
                    ✕
                  </button>
                </div>

                {addError && (
                  <div className="p-2 rounded-lg bg-red-100 border border-red-400 text-red-900 text-xs font-bold">
                    {addError}
                  </div>
                )}

                <form onSubmit={handleCreateOffering} className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-0.5">
                        Subject Code
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. CS304"
                        value={newOfferingData.subject_code}
                        onChange={(e) =>
                          setNewOfferingData({ ...newOfferingData, subject_code: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border-2 border-slate-900 bg-white shadow-[1px_1px_0_#0d0d0d] font-bold text-xs uppercase text-slate-950 placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-0.5">
                        Subject Title
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Database Management Systems"
                        value={newOfferingData.subject_name}
                        onChange={(e) =>
                          setNewOfferingData({ ...newOfferingData, subject_name: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border-2 border-slate-900 bg-white shadow-[1px_1px_0_#0d0d0d] font-bold text-xs text-slate-950 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-0.5">
                        Assigned Division / Batch
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. B (or Batch 1)"
                        value={newOfferingData.division_name}
                        onChange={(e) =>
                          setNewOfferingData({ ...newOfferingData, division_name: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border-2 border-slate-900 bg-white shadow-[1px_1px_0_#0d0d0d] font-bold text-xs uppercase text-slate-950 placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-0.5">
                        Class Semester
                      </label>
                      <select
                        value={newOfferingData.semester}
                        onChange={(e) =>
                          setNewOfferingData({ ...newOfferingData, semester: Number(e.target.value) })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border-2 border-slate-900 bg-white shadow-[1px_1px_0_#0d0d0d] font-bold text-xs text-slate-950"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                          <option key={s} value={s}>
                            Semester {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-0.5">
                        Branch Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CSE"
                        value={newOfferingData.branch_code}
                        onChange={(e) =>
                          setNewOfferingData({ ...newOfferingData, branch_code: e.target.value.toUpperCase() })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border-2 border-slate-900 bg-white shadow-[1px_1px_0_#0d0d0d] font-bold text-xs uppercase text-slate-950 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-3 py-1.5 rounded-xl border border-slate-900 bg-white font-black text-xs uppercase tracking-wider hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addLoading}
                      className="px-4 py-1.5 rounded-xl border-2 border-slate-900 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_#0d0d0d] transition active:translate-y-0.5 disabled:opacity-50"
                    >
                      {addLoading ? "Adding..." : "Assign to Teaching Portfolio →"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {offerings.map((off) => (
                <div
                  key={off.offering_id}
                  className="p-5 rounded-2xl bg-white border-2 border-slate-900 shadow-[3px_3px_0_#0d0d0d] flex flex-col justify-between hover:-translate-y-0.5 transition-transform"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-amber-100 border border-slate-900 text-slate-950 shadow-[1px_1px_0_#0d0d0d]">
                          {off.subject_code}
                        </span>
                        <span className="text-[10px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-300">
                          Div {off.division_name} • Sem {off.semester}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveOffering(off.offering_id, off.subject_code, off.subject_name)}
                        disabled={removingId === off.offering_id}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 border border-transparent hover:border-slate-900 transition"
                        title="Remove subject from your teaching portfolio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h3 className="font-black text-slate-900 text-sm sm:text-base leading-snug">
                      {off.subject_name}
                    </h3>

                    <p className="text-xs text-slate-600 font-bold mt-2 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span>{off.enrolled_students_count} Students Enrolled</span>
                    </p>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {off.branch_code || "CSE"} Batch
                    </span>
                    <Link
                      href={`/teacher/session/new?offering=${off.offering_id}`}
                      className="inline-flex items-center gap-1 text-xs font-black text-amber-700 hover:text-amber-900 underline decoration-slate-400"
                    >
                      Start Roll Call →
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* AI Classroom Guidance Note */}
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d]">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                Classroom AI Coverage Tip
              </h4>
              <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                When snapping your classroom photos, take 2 to 3 wide shots (left aisle, center, right aisle). ArcFace 512-d automatically aggregates all faces detected and compares them exclusively against that division's enrolled roster.
              </p>
            </div>
          </div>

          {/* Right: Recent Sessions Activity (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600 stroke-[2.5]" />
                Recent Sessions
              </h2>
            </div>

            <div className="space-y-3">
              {recentSessions.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d] text-center text-slate-500 text-xs font-medium">
                  No confirmed sessions yet. Start your first roll call above!
                </div>
              ) : (
                recentSessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="p-4 rounded-xl bg-white border-2 border-slate-900 shadow-[2.5px_2.5px_0_#0d0d0d] flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-slate-900">
                        {sess.subject_code} • Div {sess.division_name}
                      </span>
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                          sess.status === "confirmed"
                            ? "bg-emerald-100 text-emerald-900 border-emerald-400"
                            : "bg-amber-100 text-amber-900 border-amber-400"
                        }`}
                      >
                        {sess.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 flex items-center gap-1 font-semibold">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      {sess.session_date}
                    </p>

                    <div className="flex items-center justify-between text-xs text-slate-700 pt-2 border-t border-slate-100">
                      <span className="font-bold text-[11px]">
                        <strong className="text-emerald-600">{sess.present_count}</strong> Present /{" "}
                        <span className="text-slate-400">{sess.total_enrolled} Total</span>
                      </span>
                      <Link
                        href={`/teacher/session/${sess.id}`}
                        className="text-[11px] font-black text-slate-900 hover:text-amber-700 underline"
                      >
                        Audit & Lock →
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 3. Class Roster & At-Risk (< 75%) Student Supervision Panel */}
        <div className="bg-white rounded-2xl border-2 border-slate-900 shadow-[4px_4px_0_#0d0d0d] p-6 space-y-6">
          {/* Header & Course Switcher */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-slate-900 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-slate-900 shadow-[1px_1px_0_#0d0d0d] flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3 text-rose-600" />
                  Academic Attendance Supervision
                </span>
                <span className="text-xs font-bold text-slate-500">
                  75% Statutory Compliance Rule
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                Class Attendance Roster & Defaulter Tracking
              </h2>
            </div>

            {/* Subject Selector Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {offerings.map((off) => (
                <button
                  key={off.offering_id}
                  onClick={() => setSelectedOfferingId(off.offering_id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition border-2 border-slate-900 ${
                    selectedOfferingId === off.offering_id
                      ? "bg-amber-400 text-slate-950 shadow-[2px_2px_0_#0d0d0d]"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100 shadow-[1.5px_1.5px_0_#0d0d0d]"
                  }`}
                >
                  {off.subject_code} (Div {off.division_name})
                </button>
              ))}
            </div>
          </div>

          {rosterLoading ? (
            <div className="p-8 text-center text-slate-500 font-bold text-xs">
              Loading student roster & attendance statistics...
            </div>
          ) : !rosterData ? (
            <div className="p-8 text-center text-slate-500 font-bold text-xs">
              Select an academic offering above to view the student attendance roster.
            </div>
          ) : (
            <div className="space-y-5">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d]">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Total Enrolled
                  </p>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    {rosterData.total_students}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                    Div {rosterData.division_name} • Sem {rosterData.semester}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d]">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Lectures Conducted
                  </p>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    {rosterData.total_classes_held}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                    {rosterData.total_classes_held === 0 ? "No Sessions Held Yet" : "Confirmed Sessions"}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d]">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                    On Track (≥ 75%)
                  </p>
                  <p className="text-2xl font-black text-emerald-950 mt-1">
                    {rosterData.total_classes_held === 0 ? "—" : rosterData.on_track_count}
                  </p>
                  <p className="text-[10px] font-bold text-emerald-700 mt-0.5">
                    {rosterData.total_classes_held === 0 ? "Semester Start" : "Eligible for Exams"}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-rose-50 border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d]">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-wider text-rose-800">
                      At Risk (&lt; 75%)
                    </p>
                    {rosterData.at_risk_count > 0 && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    )}
                  </div>
                  <p className="text-2xl font-black text-rose-950 mt-1">
                    {rosterData.total_classes_held === 0 ? "0" : rosterData.at_risk_count}
                  </p>
                  <p className="text-[10px] font-bold text-rose-700 mt-0.5">
                    {rosterData.total_classes_held === 0 ? "No Defaulters" : "Requires Counseling"}
                  </p>
                </div>
              </div>

              {/* Filter Tabs, Search & CSV Export Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setRosterFilter("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 border-slate-900 transition ${
                      rosterFilter === "all"
                        ? "bg-slate-900 text-white shadow-[1.5px_1.5px_0_#0d0d0d]"
                        : "bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    All Students ({rosterData.students.length})
                  </button>

                  <button
                    onClick={() => setRosterFilter("at_risk")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 border-slate-900 transition flex items-center gap-1.5 ${
                      rosterFilter === "at_risk"
                        ? "bg-rose-500 text-white shadow-[1.5px_1.5px_0_#0d0d0d]"
                        : "bg-rose-50 text-rose-900 hover:bg-rose-100"
                    }`}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    At Risk &lt; 75% ({rosterData.at_risk_count})
                  </button>

                  <button
                    onClick={() => setRosterFilter("on_track")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 border-slate-900 transition flex items-center gap-1.5 ${
                      rosterFilter === "on_track"
                        ? "bg-emerald-600 text-white shadow-[1.5px_1.5px_0_#0d0d0d]"
                        : "bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    On Track ({rosterData.total_classes_held === 0 ? "—" : rosterData.on_track_count})
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <div className="relative flex-1 sm:w-56">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search student or roll..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs font-bold rounded-xl border-2 border-slate-900 bg-white shadow-[1.5px_1.5px_0_#0d0d0d] focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleExportDefaulters}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d] transition active:translate-y-0.5 shrink-0"
                  >
                    <Download className="h-3.5 w-3.5 text-amber-400" />
                    Export Defaulters (CSV)
                  </button>
                </div>
              </div>

              {/* Roster Table */}
              <div className="rounded-xl border-2 border-slate-900 overflow-hidden shadow-[2px_2px_0_#0d0d0d]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b-2 border-slate-900 text-slate-700 uppercase tracking-wider font-mono text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4 font-black">Roll No</th>
                      <th className="py-2.5 px-4 font-black">Student Name & URN</th>
                      <th className="py-2.5 px-4 font-black">Lectures Attended</th>
                      <th className="py-2.5 px-4 font-black">Attendance %</th>
                      <th className="py-2.5 px-4 font-black text-right">Academic Standing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 font-bold">
                          No students match the current filter.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((st) => (
                        <tr
                          key={st.student_id}
                          className={`hover:bg-slate-50/80 transition ${
                            st.is_at_risk ? "bg-rose-50/30" : ""
                          }`}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {st.roll_number}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-black text-slate-900">{st.full_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{st.urn}</p>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-700">
                            {st.total_classes === 0 ? (
                              <span className="text-slate-400 font-mono text-[11px]">0 / 0 Held</span>
                            ) : (
                              `${st.attended_classes} / ${st.total_classes} Held`
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {st.total_classes === 0 || st.attendance_percentage === null ? (
                              <div className="flex items-center gap-2 max-w-[140px]">
                                <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
                                  <div className="h-full rounded-full bg-slate-300 w-0" />
                                </div>
                                <span className="font-mono font-bold text-xs text-slate-400">—</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 max-w-[140px]">
                                <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
                                  <div
                                    className={`h-full rounded-full ${
                                      st.attendance_percentage >= 75
                                        ? "bg-emerald-500"
                                        : "bg-rose-500"
                                    }`}
                                    style={{
                                      width: `${Math.min(100, Math.round(st.attendance_percentage))}%`,
                                    }}
                                  />
                                </div>
                                <span
                                  className={`font-mono font-black text-xs ${
                                    st.attendance_percentage >= 75
                                      ? "text-emerald-700"
                                      : "text-rose-700"
                                  }`}
                                >
                                  {st.attendance_percentage}%
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {st.total_classes === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] uppercase border border-slate-300">
                                Awaiting 1st Session
                              </span>
                            ) : st.is_at_risk ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 font-black text-[10px] uppercase border border-rose-300">
                                <AlertTriangle className="h-3 w-3 text-rose-600" />
                                At Risk (&lt; 75%)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-black text-[10px] uppercase border border-emerald-300">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                Eligible (≥ 75%)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
