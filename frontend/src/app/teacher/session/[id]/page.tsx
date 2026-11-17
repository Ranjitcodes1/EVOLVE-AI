"use client";

import { useEffect, useState, use, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  SessionProposalsResponse,
  AttendanceProposalItem,
} from "@/lib/api";
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Users,
  Download,
  Lock,
  Edit3,
  Search,
  Filter,
  Save,
  Check,
  X,
  FileSpreadsheet,
} from "lucide-react";

export default function AttendanceReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500">Loading session review...</div>}>
      <AttendanceReviewContent sessionId={resolvedParams.id} />
    </Suspense>
  );
}

function AttendanceReviewContent({ sessionId }: { sessionId: string }) {
  const router = useRouter();

  const [data, setData] = useState<SessionProposalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search
  const [filterState, setFilterState] = useState<"all" | "needs_review" | "accepted" | "not_detected">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit / Override Modal State
  const [editingStudent, setEditingStudent] = useState<AttendanceProposalItem | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<"present" | "absent" | "late" | "excused">("present");
  const [overrideReason, setOverrideReason] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Confirm Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

  const fetchSessionProposals = async (isPoll = false) => {
    try {
      if (!isPoll) setLoading(true);
      const res = await api.getProposals(sessionId);
      setData(res);
      return res;
    } catch (err: any) {
      if (!isPoll) setError(err.message || "Failed to load session proposals");
      return null;
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    fetchSessionProposals().then((res) => {
      if (res && (res.status === "processing" || res.status === "queued")) {
        intervalId = setInterval(async () => {
          const updated = await fetchSessionProposals(true);
          if (updated && updated.status !== "processing" && updated.status !== "queued") {
            if (intervalId) clearInterval(intervalId);
          }
        }, 2000);
      }
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [sessionId]);

  const handleOpenEdit = (student: AttendanceProposalItem) => {
    setEditingStudent(student);
    setOverrideStatus(student.proposed_status);
    setOverrideReason(
      student.review_state === "not_detected"
        ? "Present in classroom, seated outside camera focal range"
        : student.correction_reason || "Verified in person by faculty"
    );
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    if (!overrideReason.trim()) {
      alert("A reason is mandatory for all manual attendance corrections to maintain audit compliance.");
      return;
    }

    setSavingEdit(true);
    try {
      await api.updateRecords(sessionId, [
        {
          student_id: editingStudent.student_id,
          status: overrideStatus,
          reason: overrideReason,
        },
      ]);
      setEditingStudent(null);
      await fetchSessionProposals();
    } catch (err: any) {
      alert(err.message || "Failed to update attendance record");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmAttendance = async () => {
    setConfirming(true);
    try {
      await api.confirmSession(sessionId);
      setShowConfirmModal(false);
      setConfirmedSuccess(true);
      await fetchSessionProposals();
    } catch (err: any) {
      alert(err.message || "Failed to confirm attendance");
    } finally {
      setConfirming(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-slate-500">
        Loading attendance proposals and computer vision detections...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-red-600 font-semibold mb-2">{error || "Session not found"}</p>
        <button
          onClick={() => router.push("/teacher")}
          className="text-indigo-600 text-sm hover:underline font-medium"
        >
          ← Return to Teacher Dashboard
        </button>
      </div>
    );
  }

  // Filtered proposals
  const filteredProposals = data.proposals.filter((p) => {
    const matchesFilter =
      filterState === "all" ? true : p.review_state === filterState;
    const matchesSearch =
      searchQuery === "" ||
      p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.urn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.roll_number && p.roll_number.includes(searchQuery));
    return matchesFilter && matchesSearch;
  });

  const isConfirmed = data.status === "confirmed";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Session Title Header */}
      <div className="bg-white rounded-2xl border-2 border-slate-900 p-6 sm:p-7 shadow-[4px_4px_0_#0d0d0d] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-amber-100 text-slate-950 border border-slate-900 shadow-[1px_1px_0_#0d0d0d]">
              {data.subject_code}
            </span>
            <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-900">
              Division {data.division_name}
            </span>
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-slate-900 shadow-[1px_1px_0_#0d0d0d] ${
                isConfirmed
                  ? "bg-emerald-100 text-emerald-950"
                  : "bg-amber-100 text-amber-950"
              }`}
            >
              {data.status === "review_required" ? "Review Pending" : data.status}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{data.subject_name}</h1>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            Session Date: <strong className="text-slate-900">{data.session_date}</strong> • Session ID: {sessionId.slice(0, 8)}...
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={api.getExportUrl(sessionId)}
            download
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-slate-900 bg-white text-slate-950 font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_#0d0d0d] hover:bg-slate-50 transition active:translate-y-0.5"
          >
            <Download className="h-4 w-4 text-slate-900 stroke-[2.5]" />
            Export CSV
          </a>

          {!isConfirmed ? (
            <button
              onClick={() => setShowConfirmModal(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border-2 border-slate-900 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[2.5px_2.5px_0_#0d0d0d] transition active:translate-y-0.5"
            >
              <Check className="h-4 w-4 stroke-[3]" />
              Confirm Attendance Final
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-slate-900 bg-emerald-100 text-emerald-950 font-black text-xs shadow-[2px_2px_0_#0d0d0d]">
              <Lock className="h-3.5 w-3.5 stroke-[2.5]" />
              Attendance Record Confirmed &amp; Locked
            </div>
          )}
        </div>
      </div>

      {(data.status === "processing" || data.status === "queued") && (
        <div className="p-4 rounded-xl bg-amber-50 border-2 border-slate-900 shadow-[3px_3px_0_#0d0d0d] text-amber-950 text-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-amber-800 border-t-transparent rounded-full animate-spin shrink-0" />
            <div>
              <span className="font-extrabold uppercase tracking-wide text-xs text-amber-900 flex items-center gap-1.5">
                AI Vision Worker Running • ArcFace 512-d Recognition In Progress
              </span>
              <p className="text-xs text-amber-800 font-medium mt-0.5">
                Detecting classroom faces and matching with enrolled student templates. This screen is auto-refreshing...
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchSessionProposals()}
            className="px-3 py-1.5 rounded-lg border-2 border-slate-900 bg-amber-200 hover:bg-amber-300 text-slate-900 font-black text-xs uppercase tracking-wider shadow-[1.5px_1.5px_0_#0d0d0d] transition shrink-0"
          >
            Refresh Now
          </button>
        </div>
      )}

      {confirmedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border-2 border-slate-900 shadow-[3px_3px_0_#0d0d0d] text-emerald-950 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-700 stroke-[2.5]" />
            <span className="font-bold">
              Attendance verified and permanently recorded into institutional database.
            </span>
          </div>
          <button
            onClick={() => setConfirmedSuccess(false)}
            className="text-emerald-900 hover:text-black text-xs font-black uppercase tracking-wider"
          >
            Dismiss ✕
          </button>
        </div>
      )}

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border-2 border-slate-900 shadow-[3px_3px_0_#0d0d0d] flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 border border-slate-900 text-indigo-950 flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0_#0d0d0d]">
            <Users className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Enrolled</p>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{data.summary.total_enrolled}</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border-2 border-slate-900 shadow-[3px_3px_0_#0d0d0d] flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 border border-slate-900 text-emerald-950 flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0_#0d0d0d]">
            <CheckCircle2 className="h-5 w-5 stroke-[2.5] text-emerald-700" />
          </div>
          <div>
            <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Likely Matches</p>
            <p className="text-2xl font-black text-emerald-700 tracking-tight">{data.summary.likely_matches}</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border-2 border-slate-900 shadow-[3px_3px_0_#0d0d0d] flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-100 border border-slate-900 text-amber-950 flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0_#0d0d0d]">
            <AlertTriangle className="h-5 w-5 stroke-[2.5] text-amber-700" />
          </div>
          <div>
            <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider">Needs Review</p>
            <p className="text-2xl font-black text-amber-700 tracking-tight">{data.summary.needs_review}</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border-2 border-slate-900 shadow-[3px_3px_0_#0d0d0d] flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-900 text-slate-700 flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0_#0d0d0d]">
            <HelpCircle className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Not Detected</p>
            <p className="text-2xl font-black text-slate-700 tracking-tight">{data.summary.not_detected}</p>
          </div>
        </div>
      </div>

      {/* Roster Table Card */}
      <div className="bg-white rounded-2xl border-2 border-slate-900 shadow-[4px_4px_0_#0d0d0d] overflow-hidden">
        {/* Table Filters & Search */}
        <div className="p-4 sm:p-5 border-b-2 border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterState("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition border-2 border-slate-900 shadow-[1.5px_1.5px_0_#0d0d0d] ${
                filterState === "all"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              All Students ({data.proposals.length})
            </button>
            <button
              onClick={() => setFilterState("needs_review")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition border-2 border-slate-900 shadow-[1.5px_1.5px_0_#0d0d0d] ${
                filterState === "needs_review"
                  ? "bg-amber-400 text-slate-950"
                  : "bg-amber-50 text-amber-900 hover:bg-amber-100"
              }`}
            >
              Needs Review ({data.summary.needs_review})
            </button>
            <button
              onClick={() => setFilterState("accepted")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition border-2 border-slate-900 shadow-[1.5px_1.5px_0_#0d0d0d] ${
                filterState === "accepted"
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
              }`}
            >
              Likely Match ({data.summary.likely_matches})
            </button>
            <button
              onClick={() => setFilterState("not_detected")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition border-2 border-slate-900 shadow-[1.5px_1.5px_0_#0d0d0d] ${
                filterState === "not_detected"
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Not Detected ({data.summary.not_detected})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-700 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, URN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs font-bold text-slate-950 placeholder:text-slate-400 rounded-xl border-2 border-slate-900 bg-white shadow-[1.5px_1.5px_0_#0d0d0d] focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100/90 text-[11px] font-black text-slate-900 uppercase tracking-wider">
                <th className="py-3 px-4">Student &amp; URN</th>
                <th className="py-3 px-3">Roll No</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">AI Match Confidence</th>
                <th className="py-3 px-3">Review Note</th>
                <th className="py-3 px-4 text-right">Faculty Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-900 font-medium">
              {filteredProposals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                    No students match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredProposals.map((student) => (
                  <tr key={student.student_id} className="hover:bg-slate-50/90 transition">
                    <td className="py-3.5 px-4">
                      <p className="font-black text-slate-950">{student.full_name}</p>
                      <p className="text-[11px] text-slate-500 font-mono font-bold">{student.urn}</p>
                    </td>

                    <td className="py-3.5 px-3 font-bold text-slate-700">
                      {student.roll_number || "—"}
                    </td>

                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase border border-slate-900 shadow-[1px_1px_0_#0d0d0d] ${
                          student.proposed_status === "present"
                            ? "bg-emerald-100 text-emerald-950"
                            : student.proposed_status === "absent"
                            ? "bg-rose-100 text-rose-950"
                            : student.proposed_status === "late"
                            ? "bg-amber-100 text-amber-950"
                            : "bg-blue-100 text-blue-950"
                        }`}
                      >
                        {student.proposed_status}
                      </span>
                    </td>

                    <td className="py-3.5 px-3">
                      {student.similarity !== null && student.similarity !== undefined ? (
                        <div className="flex items-center gap-2 max-w-[140px]">
                          <div className="w-16 h-2.5 bg-slate-100 border border-slate-900 rounded-full overflow-hidden shadow-[0.5px_0.5px_0_#0d0d0d]">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                student.review_state === "accepted" || student.similarity >= 0.32
                                  ? "bg-emerald-500"
                                  : student.review_state === "needs_review" || student.similarity >= 0.20
                                  ? "bg-amber-500"
                                  : "bg-slate-400"
                              }`}
                              style={{ width: `${Math.min(100, Math.round(student.similarity * 100))}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-950 font-black">
                            {Math.round(student.similarity * 100)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px] font-bold">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3">
                      {student.review_state === "accepted" && (
                        <span className="text-emerald-800 font-bold flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 stroke-[2.5]" /> Likely match
                        </span>
                      )}
                      {student.review_state === "needs_review" && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-amber-800 font-bold flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-700 stroke-[2.5]" /> Uncertain match
                          </span>
                          {student.correction_reason && student.correction_reason.toLowerCase().includes("presentation attack") && (
                            <span className="text-[10px] font-black text-rose-800 bg-rose-50 border border-rose-300 rounded px-1.5 py-0.5 inline-flex items-center gap-1">
                              🛡️ Spoof / Replay Flag
                            </span>
                          )}
                        </div>
                      )}
                      {student.review_state === "not_detected" && (
                        <span className="text-slate-400 font-medium">Not detected</span>
                      )}
                      {student.review_state === "corrected" && (
                        <span className="text-indigo-800 font-bold flex items-center gap-1">
                          <Edit3 className="h-3.5 w-3.5 text-indigo-700 stroke-[2.5]" /> Verified by faculty
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(student)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border-2 border-slate-900 bg-white text-slate-950 hover:bg-slate-100 font-black text-[11px] uppercase tracking-wider shadow-[1.5px_1.5px_0_#0d0d0d] transition active:translate-y-0.5"
                      >
                        <Edit3 className="h-3 w-3 stroke-[2.5]" />
                        {student.review_state === "needs_review" ? "Resolve" : "Edit"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Override & Reason Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-[6px_6px_0_#0d0d0d] border-2 border-slate-900 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900 mb-4">
              <h3 className="font-black text-slate-900 text-base">
                Manual Attendance Override
              </h3>
              <button
                onClick={() => setEditingStudent(null)}
                className="text-slate-400 hover:text-slate-900 font-black p-1"
              >
                <X className="h-5 w-5 stroke-[2.5]" />
              </button>
            </div>

            <div className="mb-4 p-3 rounded-xl bg-slate-50 border-2 border-slate-900 shadow-[1.5px_1.5px_0_#0d0d0d]">
              <p className="text-sm font-black text-slate-950">{editingStudent.full_name}</p>
              <p className="text-xs text-slate-500 font-mono font-bold">URN: {editingStudent.urn}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Attendance Status
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(["present", "absent", "late", "excused"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setOverrideStatus(st)}
                      className={`py-2 text-xs font-black rounded-xl uppercase tracking-wider transition border-2 border-slate-900 shadow-[1.5px_1.5px_0_#0d0d0d] ${
                        overrideStatus === st
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Audit Justification Reason <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Student present in class, seated in corner angle missed by camera."
                  className="w-full p-2.5 text-xs font-bold text-slate-950 placeholder:text-slate-400 rounded-xl border-2 border-slate-900 bg-white shadow-[1.5px_1.5px_0_#0d0d0d] focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
                <p className="text-[10px] text-slate-500 font-medium mt-1">
                  Required by institutional policy. This reason is saved into the immutable attendance audit trail.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-xl border-2 border-slate-900 bg-white text-slate-700 hover:bg-slate-100 text-xs font-black uppercase tracking-wider shadow-[1.5px_1.5px_0_#0d0d0d]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-xl border-2 border-slate-900 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider shadow-[2px_2px_0_#0d0d0d] active:translate-y-0.5 disabled:opacity-50"
                >
                  {savingEdit ? "Saving..." : "Save Override →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-[6px_6px_0_#0d0d0d] border-2 border-slate-900 animate-in zoom-in-95 duration-150">
            <h3 className="font-black text-slate-900 text-lg mb-2">
              Confirm Final Attendance Record?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4 font-medium">
              You are about to finalize attendance for{" "}
              <strong className="text-slate-950 font-bold">{data.subject_name} ({data.subject_code})</strong> on{" "}
              <strong className="text-slate-950 font-bold">{data.session_date}</strong>. This record will be permanently certified and locked.
            </p>

            <div className="p-4 bg-slate-50 rounded-xl mb-6 text-xs space-y-2 border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d]">
              <div className="flex justify-between font-bold">
                <span className="text-slate-500">Total Enrolled:</span>
                <span className="text-slate-900 font-mono font-black">{data.summary.total_enrolled}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-slate-500">Likely Present:</span>
                <span className="text-emerald-700 font-mono font-black">{data.summary.likely_matches}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-slate-500">Unresolved Items:</span>
                <span className="text-amber-700 font-mono font-black">{data.summary.needs_review}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl border-2 border-slate-900 bg-white text-slate-700 hover:bg-slate-100 text-xs font-black uppercase tracking-wider shadow-[1.5px_1.5px_0_#0d0d0d]"
              >
                Back to Review
              </button>
              <button
                type="button"
                onClick={handleConfirmAttendance}
                disabled={confirming}
                className="px-5 py-2 rounded-xl border-2 border-slate-900 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-[2.5px_2.5px_0_#0d0d0d] active:translate-y-0.5 disabled:opacity-50"
              >
                {confirming ? "Finalizing..." : "Yes, Confirm Attendance"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
