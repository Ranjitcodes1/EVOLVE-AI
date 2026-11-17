"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, TeacherOffering } from "@/lib/api";
import {
  Camera,
  Upload,
  Trash2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  Calendar,
  Layers,
  Users,
  Plus,
  X,
} from "lucide-react";

export default function NewAttendanceSessionPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500 font-bold">Loading session workspace...</div>}>
      <NewAttendanceSessionContent />
    </Suspense>
  );
}

function NewAttendanceSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultOfferingId = searchParams.get("offering");
  const { user, isLoading } = useAuth();

  const [offerings, setOfferings] = useState<TeacherOffering[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>("");
  const [sessionDate, setSessionDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [sessionId, setSessionId] = useState<string | null>(null);

  // AUTH GUARD: If not logged in as teacher, redirect directly to faculty sign-in
  useEffect(() => {
    if (!isLoading && (!user || user.role !== "teacher")) {
      router.replace("/login?role=teacher");
    }
  }, [user, isLoading, router]);

  // Custom Course & Subject Typing State
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customCourse, setCustomCourse] = useState("Computer Science & Engineering");
  const [customBranch, setCustomBranch] = useState("CSE");
  const [customSubjectCode, setCustomSubjectCode] = useState("");
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [customDivision, setCustomDivision] = useState("A");
  const [customSemester, setCustomSemester] = useState(3);
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  // Classroom Captured Images State
  const [capturedImages, setCapturedImages] = useState<{ id: string; blob: Blob; url: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Camera stream
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "teacher") return;

    async function fetchOfferings() {
      try {
        const list = await api.getTeacherOfferings();
        setOfferings(list);
        if (list.length > 0) {
          const match = list.find((o) => o.offering_id === defaultOfferingId);
          setSelectedOfferingId(match ? match.offering_id : list[0].offering_id);
        } else {
          // If no offerings exist, default to custom creation mode
          setIsCustomMode(true);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load academic subjects");
      }
    }
    fetchOfferings();
  }, [user, defaultOfferingId]);

  const handleAddCustomOffering = async () => {
    if (!customSubjectCode.trim() || !customSubjectName.trim()) {
      setError("Please type both a Subject Code (e.g. CS306) and a Subject Name (e.g. Cloud Computing).");
      return;
    }
    setIsAddingCustom(true);
    setError(null);
    try {
      const newOffering = await api.createCustomOffering({
        course_name: customCourse,
        branch_code: customBranch,
        subject_code: customSubjectCode.trim().toUpperCase(),
        subject_name: customSubjectName.trim(),
        division_name: customDivision.trim().toUpperCase(),
        semester: customSemester,
      });
      setOfferings((prev) => [newOffering, ...prev]);
      setSelectedOfferingId(newOffering.offering_id);
      setIsCustomMode(false);
      setCustomSubjectCode("");
      setCustomSubjectName("");
    } catch (err: any) {
      setError(err.message || "Failed to create custom academic offering");
    } finally {
      setIsAddingCustom(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;
    let localStream: MediaStream | null = null;

    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "environment" },
        });
        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStream = stream;
        if (videoRef.current) {
          const video = videoRef.current;
          video.srcObject = stream;
          video.onloadedmetadata = () => {
            if (isCancelled) return;
            const playPromise = video.play();
            if (playPromise !== undefined) {
              playPromise.catch((err) => {
                if (err.name !== "AbortError") {
                  console.warn("Camera video playback error:", err);
                }
              });
            }
          };
          setCameraActive(true);
        }
      } catch (err) {
        if (!isCancelled) {
          console.warn("Camera access denied or unavailable", err);
        }
      }
    }

    initCamera();

    return () => {
      isCancelled = true;
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current) {
        if (videoRef.current.srcObject) {
          const s = videoRef.current.srcObject as MediaStream;
          s.getTracks().forEach((track) => track.stop());
          videoRef.current.srcObject = null;
        }
      }
      setCameraActive(false);
    };
  }, []);

  const handleCapturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            setCapturedImages((prev) => [
              ...prev,
              { id: Math.random().toString(), blob, url },
            ]);
          }
        }, "image/jpeg", 0.92);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const newItems = files.map((file) => ({
        id: Math.random().toString(),
        blob: file,
        url: URL.createObjectURL(file),
      }));
      setCapturedImages((prev) => [...prev, ...newItems]);
    }
  };

  const removeImage = (id: string) => {
    setCapturedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleProcessAttendance = async () => {
    if (!selectedOfferingId) {
      setError("Please select an assigned course offering.");
      return;
    }
    if (capturedImages.length === 0) {
      setError("Please snap or upload at least 1 classroom photograph.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      // 1. Create session
      const sess = await api.createSession(selectedOfferingId, sessionDate);
      setSessionId(sess.session_id);

      // 2. Upload photo assets
      const files = capturedImages.map(
        (img, idx) => new File([img.blob], `classroom_${idx + 1}.jpg`, { type: "image/jpeg" })
      );
      await api.uploadSessionAssets(sess.session_id, files);

      // 3. Trigger ArcFace 512-d multi-face recognition
      await api.processRecognition(sess.session_id);

      // 4. Navigate to interactive review & lock screen
      router.push(`/teacher/session/${sess.session_id}`);
    } catch (err: any) {
      setError(err.message || "Failed to process attendance photos.");
      setIsProcessing(false);
    }
  };

  const selectedOffering = offerings.find((o) => o.offering_id === selectedOfferingId);

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-amber-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/teacher"
            className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700 hover:text-slate-950 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <span className="text-xs font-bold text-slate-500">
            YuNet Detection • ArcFace 512-d Recognition
          </span>
        </div>

        {/* 1. Academic Course & Division Context Bar */}
        <div className="bg-white rounded-2xl border-2 border-slate-900 shadow-[4px_4px_0_#0d0d0d] p-6">
          <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-slate-900">
            <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Camera className="h-5 w-5 text-amber-600 stroke-[2.5]" />
              New Classroom Roll-Call Session
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-slate-900 border border-slate-900">
              Live Studio
            </span>
          </div>

          {/* Dynamic Academic Class Context / Custom Creation Form */}
          {isCustomMode ? (
            <div className="bg-amber-50/50 rounded-xl border-2 border-dashed border-amber-400 p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-amber-700" />
                    Type Custom Academic Course & Subject
                  </h3>
                  <p className="text-[11px] text-slate-600 font-medium">
                    Type your specific course, subject, and division to auto-generate the class roster.
                  </p>
                </div>
                {offerings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsCustomMode(false)}
                    className="text-xs font-black text-slate-700 hover:text-slate-950 flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 hover:bg-white transition"
                  >
                    <X className="h-3 w-3" /> Back to My List
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {/* Course Name */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    Course / Degree Program
                  </label>
                  <input
                    type="text"
                    list="new-session-course-suggestions"
                    placeholder="e.g. Computer Science & Engineering"
                    value={customCourse}
                    onChange={(e) => setCustomCourse(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-slate-900 bg-white shadow-[1.5px_1.5px_0_#0d0d0d] focus:outline-none focus:border-amber-500"
                  />
                  <datalist id="new-session-course-suggestions">
                    <option value="Computer Science & Engineering" />
                    <option value="Information Technology" />
                    <option value="Artificial Intelligence & Data Science" />
                    <option value="Electronics & Communication" />
                    <option value="Mechanical Engineering" />
                    <option value="Master of Computer Applications (MCA)" />
                    <option value="Bachelor of Computer Applications (BCA)" />
                  </datalist>
                </div>

                {/* Branch Code */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    Branch Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CSE"
                    value={customBranch}
                    onChange={(e) => setCustomBranch(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-slate-900 bg-white shadow-[1.5px_1.5px_0_#0d0d0d] focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Subject Code */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    Subject Code
                  </label>
                  <input
                    type="text"
                    list="new-session-subj-code-suggestions"
                    placeholder="e.g. CS306"
                    value={customSubjectCode}
                    onChange={(e) => setCustomSubjectCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-slate-900 bg-white shadow-[1.5px_1.5px_0_#0d0d0d] focus:outline-none focus:border-amber-500"
                  />
                  <datalist id="new-session-subj-code-suggestions">
                    <option value="CS301" />
                    <option value="CS302" />
                    <option value="CS303" />
                    <option value="CS304" />
                    <option value="CS305" />
                    <option value="CS306" />
                    <option value="AI401" />
                  </datalist>
                </div>

                {/* Subject Name */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    Subject Name / Title
                  </label>
                  <input
                    type="text"
                    list="new-session-subj-name-suggestions"
                    placeholder="e.g. Cloud Computing & DevOps"
                    value={customSubjectName}
                    onChange={(e) => setCustomSubjectName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-slate-900 bg-white shadow-[1.5px_1.5px_0_#0d0d0d] focus:outline-none focus:border-amber-500"
                  />
                  <datalist id="new-session-subj-name-suggestions">
                    <option value="Cloud Computing & DevOps" />
                    <option value="Machine Learning & Deep Neural Nets" />
                    <option value="Computer Networks" />
                    <option value="Database Management Systems" />
                    <option value="Operating Systems" />
                    <option value="Design & Analysis of Algorithms" />
                    <option value="Cyber Security & Cryptography" />
                  </datalist>
                </div>

                {/* Division */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    Class Division
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. A"
                    value={customDivision}
                    onChange={(e) => setCustomDivision(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-slate-900 bg-white shadow-[1.5px_1.5px_0_#0d0d0d] focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Semester */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    Class Semester
                  </label>
                  <select
                    value={customSemester}
                    onChange={(e) => setCustomSemester(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-slate-900 bg-white shadow-[1.5px_1.5px_0_#0d0d0d] focus:outline-none focus:border-amber-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleAddCustomOffering}
                  disabled={isAddingCustom}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider border-2 border-slate-900 shadow-[2px_2px_0_#0d0d0d] transition active:translate-y-0.5 disabled:opacity-50"
                >
                  {isAddingCustom ? "Adding Class Offering..." : "✓ Add & Start with this Subject Offering"}
                </button>
                {offerings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsCustomMode(false)}
                    className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs border border-slate-300 transition"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Subject Offering */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700">
                    Select Course & Subject
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomMode(true)}
                    className="text-[10px] font-black text-amber-700 hover:text-amber-900 underline flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" /> Type Custom
                  </button>
                </div>
                <select
                  value={selectedOfferingId}
                  onChange={(e) => setSelectedOfferingId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border-2 border-slate-900 bg-white shadow-[1.5px_1.5px_0_#0d0d0d] focus:outline-none focus:border-amber-500"
                >
                  {offerings.map((o) => (
                    <option key={o.offering_id} value={o.offering_id}>
                      {o.subject_code} — {o.subject_name} (Div {o.division_name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Division & Enrolled Students */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                  Classroom Division Context
                </label>
                <div className="w-full px-3 py-2 text-xs font-bold rounded-xl border-2 border-slate-900 bg-slate-50 text-slate-800 shadow-[1.5px_1.5px_0_#0d0d0d] flex items-center justify-between">
                  <span>
                    Div {selectedOffering?.division_name || "A"} • Sem {selectedOffering?.semester || 3}
                  </span>
                  <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                    {selectedOffering?.enrolled_students_count || 0} Students Roster
                  </span>
                </div>
              </div>

              {/* Session Date */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                  Session Lecture Date
                </label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border-2 border-slate-900 bg-white shadow-[1.5px_1.5px_0_#0d0d0d] focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-100 border-2 border-slate-900 shadow-[2.5px_2.5px_0_#0d0d0d] text-red-900 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* 2. Camera Viewfinder & Image Gallery Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
          {/* Left: Live Viewfinder (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-950 rounded-2xl overflow-hidden aspect-video relative flex items-center justify-center border-2 border-slate-900 shadow-[3.5px_3.5px_0_#0d0d0d]">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur text-white text-[10px] font-black uppercase tracking-wider border border-white/20 flex items-center gap-1.5 shadow">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Classroom Camera
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCapturePhoto}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider border-2 border-slate-900 shadow-[2.5px_2.5px_0_#0d0d0d] transition active:translate-y-0.5"
              >
                <Camera className="h-4 w-4" />
                Snap Classroom Angle
              </button>

              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-900 bg-white text-slate-900 font-black text-xs uppercase tracking-wider shadow-[2.5px_2.5px_0_#0d0d0d] hover:bg-slate-50 cursor-pointer transition active:translate-y-0.5">
                <Upload className="h-4 w-4" />
                Upload Lecture Photos
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Right: Snapped Images Gallery & ArcFace Trigger (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-white rounded-2xl border-2 border-slate-900 p-6 shadow-[3.5px_3.5px_0_#0d0d0d]">
            <div>
              <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900 mb-4">
                <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-amber-600 stroke-[2.5]" />
                  Classroom Captures ({capturedImages.length})
                </h3>
                <span className="text-[10px] font-bold text-slate-500">2–3 angles recommended</span>
              </div>

              {capturedImages.length === 0 ? (
                <div className="py-12 px-4 text-center border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
                  <Camera className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-black text-slate-700">No photos snapped yet</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Click "Snap Classroom Angle" or upload photos covering all rows of students.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {capturedImages.map((img, i) => (
                    <div
                      key={img.id}
                      className="relative group rounded-xl overflow-hidden aspect-video border-2 border-slate-900 bg-slate-100 shadow-[1.5px_1.5px_0_#0d0d0d]"
                    >
                      <img
                        src={img.url}
                        alt={`Capture ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/80 rounded text-[9px] text-white font-mono font-bold">
                        #{i + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded border border-black opacity-0 group-hover:opacity-100 transition"
                        title="Remove photo"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-5 border-t-2 border-slate-900 mt-6 space-y-2.5">
              <button
                type="button"
                onClick={handleProcessAttendance}
                disabled={isProcessing || capturedImages.length === 0}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[3px_3px_0_#0d0d0d] border-2 border-slate-900 transition flex items-center justify-center gap-2 active:translate-y-0.5 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Sparkles className="h-4 w-4 animate-spin text-slate-950" />
                    <span>Running ArcFace 512-d Face Matcher...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Run AI Recognition & Verify ({selectedOffering?.enrolled_students_count || 0} Students) →</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-center text-slate-500 font-semibold">
                AI classifies candidates against Division {selectedOffering?.division_name || "A"} roster for instant review.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
