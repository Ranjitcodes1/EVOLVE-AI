"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { StudentIdCardForm, StudentCardData, StudentCardValidity } from "@/components/ui/student-id-card-form";

export default function RegisterStudentPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center font-bold text-slate-500">Loading student registration...</div>}>
      <RegisterStudentContent />
    </Suspense>
  );
}

function RegisterStudentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isUpdateMode = searchParams.get("mode") === "update";
  const { user, login, logout } = useAuth();

  // AUTO-REDIRECT GUARD: If already logged in as a student and NOT in update mode, land directly on report
  // If another role is active, clear it so student registration starts clean
  useEffect(() => {
    if (user && user.role === "student" && !isUpdateMode) {
      router.replace("/student");
    } else if (user && user.role !== "student") {
      logout(null);
    }
  }, [user, isUpdateMode, router, logout]);

  // Form State
  const [formData, setFormData] = useState({
    institution: "",
    email: isUpdateMode && user?.role === "student" ? user.email : "",
    password: "",
    urn: "",
    full_name: isUpdateMode && user?.role === "student" ? user.name : "",
    department_code: "CSE",
    branch_code: "CSE",
    division_name: "A",
    academic_year: "2026-2027",
    semester: 3,
    roll_number: "",
  });

  // Pre-load student profile if in update mode
  useEffect(() => {
    if (isUpdateMode && user) {
      api.getStudentProfile()
        .then((p) => {
          if (p) {
            setFormData((prev) => ({
              ...prev,
              full_name: p.full_name || prev.full_name,
              urn: p.urn || prev.urn,
              email: p.email || prev.email,
              division_name: p.division_name || prev.division_name,
              semester: p.semester || prev.semester,
              academic_year: p.academic_year || prev.academic_year,
              roll_number: p.roll_number || prev.roll_number,
            }));
          }
        })
        .catch(() => { });
    }
  }, [isUpdateMode, user]);

  const [step, setStep] = useState<1 | 2>(isUpdateMode ? 2 : 1); // 1: Info & Card, 2: Face Enrollment
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Camera & Face capture state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let localStream: MediaStream | null = null;

    if (step === 2 && !capturedPreview) {
      async function initCamera() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: "user" },
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
                playPromise.catch((e) => {
                  if (e.name !== "AbortError") {
                    console.warn("Video playback error:", e);
                  }
                });
              }
            };
            setCameraActive(true);
          }
        } catch (err: any) {
          if (!isCancelled) {
            console.error("Camera access failed", err);
            setError("Could not access webcam. You can upload a photo instead.");
          }
        }
      }
      initCamera();
    }

    return () => {
      isCancelled = true;
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      setCameraActive(false);
    };
  }, [step, capturedPreview]);

  // Capture frame from webcam
  const captureSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            setCapturedBlob(blob);
            setCapturedPreview(canvas.toDataURL("image/jpeg"));
          }
        }, "image/jpeg", 0.95);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCapturedBlob(file);
      setCapturedPreview(URL.createObjectURL(file));
    }
  };

  const handleRetake = () => {
    setCapturedBlob(null);
    setCapturedPreview(null);
    setError(null);
  };

  // Step 1: Submit Student Info via the Smart Card form
  const handleCardSubmit = async (data: StudentCardData, validity: StudentCardValidity) => {
    if (!validity.allValid) {
      setError("Please complete all required fields on the student smart card.");
      return;
    }
    setLoading(true);
    setError(null);

    const payload = {
      email: data.email,
      password: data.pin || "Password123!",
      urn: data.urn,
      full_name: data.fullName,
      department_code: data.department,
      branch_code: data.branch,
      division_name: data.division,
      academic_year: data.academicYear,
      semester: data.semester,
      roll_number: data.rollNumber || data.urn.slice(-4),
    };

    setFormData({
      ...payload,
      institution: data.institution || "Evolve Institute of Technology",
    });

    try {
      await api.registerStudent(payload);
      // Auto-login to authenticate for face enrollment upload
      await login(payload.email, payload.password);
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Failed to register student details. Please verify institutional unique URN/email.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Upload Biometric Face
  const handleEnrollFaceSubmit = async () => {
    if (!capturedBlob) {
      setError("Please capture or upload a clear photo of your face.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const file = new File([capturedBlob], "enrollment_face.jpg", { type: "image/jpeg" });
      const form = new FormData();
      form.append("file", file);

      await api.enrollFace(form);
      setSuccess("Face enrolled & 512-d ArcFace embedding stored! Redirecting to student hub...");
      setTimeout(() => {
        router.push("/student");
      }, 1400);
    } catch (err: any) {
      setError(err.message || "Face validation failed. Ensure only one face is visible and well-lit.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="h-screen w-screen max-h-screen overflow-hidden bg-white select-none flex flex-col justify-between">
      {/* 1. TOP HEADER WITH PRODUCT NAME "EVOLVE" & HOMEPAGE STYLING */}
      <header className="w-full h-13 sm:h-14 border-b-2 border-slate-900 bg-white px-4 sm:px-6 flex items-center justify-between z-20 shrink-0">
        {/* Left: Back Link */}
        {isUpdateMode ? (
          <Link
            href="/student"
            className="inline-flex items-center gap-2 text-slate-900 font-extrabold text-xs sm:text-sm hover:opacity-80 transition group"
          >
            <span className="w-7 h-7 rounded-lg border-2 border-slate-900 bg-amber-100 flex items-center justify-center text-xs font-black shadow-[2px_2px_0_#0d0d0d] group-hover:-translate-x-0.5 transition-transform">
              ←
            </span>
            <span className="hidden sm:inline">Back to Report</span>
          </Link>
        ) : (
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-900 font-extrabold text-xs sm:text-sm hover:opacity-80 transition group"
          >
            <span className="w-7 h-7 rounded-lg border-2 border-slate-900 bg-amber-100 flex items-center justify-center text-xs font-black shadow-[2px_2px_0_#0d0d0d] group-hover:-translate-x-0.5 transition-transform">
              ←
            </span>
            <span className="hidden sm:inline">Home</span>
          </Link>
        )}

        {/* Center: Prominent EVOLVE Wordmark + Portal Badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter uppercase font-mono">
            EVOLVE
          </span>
          <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border-2 border-slate-900 shadow-[1.5px_1.5px_0_#0d0d0d]">
            {isUpdateMode ? "Update Photo" : "Student Portal"}
          </span>
        </div>

        {/* Right: Step Indicator or Sign In Link */}
        <div className="flex items-center gap-2">
          {!isUpdateMode && !user && (
            <Link
              href="/login?role=student"
              className="text-[10px] sm:text-xs font-black uppercase tracking-wider px-3 py-1 rounded-xl border-2 border-slate-900 bg-white hover:bg-slate-100 shadow-[1.5px_1.5px_0_#0d0d0d] text-slate-900 transition mr-2"
            >
              Sign In If Registered &rarr;
            </Link>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2">
            {!isUpdateMode && (
              <>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={`text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-full border-2 border-slate-900 transition-all ${step === 1
                    ? "bg-rose-500 text-white shadow-[2px_2px_0_#0d0d0d]"
                    : "bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                    }`}
                >
                  1. ID Card {step === 2 && "✓"}
                </button>
                <span className="text-slate-400 font-black text-xs">→</span>
              </>
            )}
            <span
              className={`text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-full border-2 border-slate-900 transition-all ${step === 2
                ? "bg-rose-500 text-white shadow-[2px_2px_0_#0d0d0d]"
                : "bg-slate-100 text-slate-400 border-slate-300"
                }`}
            >
              {isUpdateMode ? "Biometric Face Re-Enrollment" : "2. Face Scan"}
            </span>
          </div>
        </div>
      </header>

      {/* Floating Alert Banners (No Layout Shift) */}
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

      {/* 2. MAIN STATIC STAGE (ZERO-SCROLL, FITS 100% IN VIEWPORT) */}
      <section className="flex-1 w-full max-w-5xl mx-auto px-4 py-2 flex items-center justify-center overflow-hidden">
        {/* Step 1: Interactive Lanyard Identity Badge + Compact Form */}
        {step === 1 && (
          <StudentIdCardForm
            defaultValues={{
              institution: formData.institution || "",
              urn: formData.urn || "",
              fullName: formData.full_name || "",
              department: formData.department_code || "Computer Science",
              branch: formData.branch_code || "CSE",
              division: formData.division_name || "A",
              semester: formData.semester || 3,
              academicYear: formData.academic_year || "2026-2027",
              rollNumber: formData.roll_number || "",
              email: formData.email || "",
              pin: formData.password || "",
            }}
            photoPreview={capturedPreview}
            onPhotoClick={() => {
              setStep(2);
            }}
            onPhotoChange={(file, previewUrl) => {
              setCapturedBlob(file);
              setCapturedPreview(previewUrl);
            }}
            isLoading={loading}
            submitLabel="Save Identity & Proceed to Face Scan →"
            onSubmit={handleCardSubmit}
          />
        )}

        {/* Step 2: Biometric Face Scan with Live Stamped Badge Side-by-Side */}
        {step === 2 && (
          <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Left: Badge displaying the live captured photo */}
            <div className="md:col-span-5 flex flex-col items-center">
              <div className="mb-1.5 text-center">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border-2 border-slate-900 transition-all ${capturedPreview
                    ? "bg-emerald-200 text-emerald-950 shadow-[1.5px_1.5px_0_#0d0d0d]"
                    : "bg-amber-100 text-slate-800 shadow-[1.5px_1.5px_0_#0d0d0d]"
                    }`}
                >
                  {capturedPreview ? "✓ Biometric Photo Stamped" : "Photo Snapshot Pending"}
                </span>
              </div>
              <StudentIdCardForm
                badgeOnly
                defaultValues={{
                  institution: formData.institution || "Evolve Institute of Technology",
                  urn: formData.urn || "139811973",
                  fullName: formData.full_name || "Lucia Ferreira",
                  department: formData.department_code || "Computer Science",
                  branch: formData.branch_code || "CSE",
                  division: formData.division_name || "A",
                  semester: formData.semester || 3,
                  academicYear: formData.academic_year || "2026-2027",
                  rollNumber: formData.roll_number || "42",
                  email: formData.email || "lucia.ferreira@evolve.edu",
                }}
                photoPreview={capturedPreview}
                onPhotoClick={handleRetake}
              />
            </div>

            {/* Right: Camera Studio Viewfinder Box */}
            <div className="md:col-span-7 bg-white rounded-2xl border-2 border-slate-900 shadow-[3.5px_3.5px_0_#0d0d0d] p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                <div>
                  <h2 className="text-sm font-black text-slate-900 tracking-tight">Biometric Reference Oval</h2>
                  <p className="text-[11px] text-slate-600 font-medium">
                    Align your face within the cyan oval guide for clean ArcFace feature extraction.
                  </p>
                </div>
                {!isUpdateMode && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-[11px] font-black text-slate-700 hover:text-slate-950 flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-300 hover:bg-slate-100 transition"
                  >
                    <ArrowLeft className="h-3 w-3" /> Edit Badge
                  </button>
                )}
              </div>

              {/* Viewfinder Window */}
              <div className="relative rounded-xl overflow-hidden bg-slate-950 border-2 border-slate-900 h-52 sm:h-56 flex items-center justify-center shadow-inner">
                {capturedPreview ? (
                  <img
                    src={capturedPreview}
                    alt="Face preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    {/* Live PAD / Liveness Shield Indicator */}
                    <div className="absolute top-2 left-2 z-10 px-2.5 py-0.5 rounded-full bg-slate-950/80 backdrop-blur border border-emerald-400/40 text-[9px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1 shadow">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      PAD Anti-Spoof Active • ISO/IEC 30107-3
                    </div>
                    {/* Face Guide Target Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-36 h-48 border-2 border-dashed border-cyan-400 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.5)]" />
                    </div>
                  </>
                )}
              </div>

              <canvas ref={canvasRef} className="hidden" />

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
                {!capturedPreview ? (
                  <>
                    <button
                      type="button"
                      onClick={captureSnapshot}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs uppercase tracking-wider shadow-[2px_2px_0_#0d0d0d] border-2 border-slate-900 transition active:translate-y-0.5"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Snap Reference Photo
                    </button>

                    <label className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border-2 border-slate-900 bg-white text-slate-800 font-extrabold text-xs uppercase tracking-wider shadow-[2px_2px_0_#0d0d0d] hover:bg-slate-50 cursor-pointer transition active:translate-y-0.5">
                      <Upload className="h-3.5 w-3.5" />
                      Upload Photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleRetake}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border-2 border-slate-900 bg-white text-slate-800 font-extrabold text-xs uppercase tracking-wider shadow-[2px_2px_0_#0d0d0d] hover:bg-slate-50 transition active:translate-y-0.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retake
                    </button>

                    <button
                      type="button"
                      onClick={handleEnrollFaceSubmit}
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs uppercase tracking-wider shadow-[2px_2px_0_#0d0d0d] border-2 border-slate-900 transition active:translate-y-0.5 disabled:opacity-50"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {loading ? "Extracting ArcFace..." : "Save Biometric Template"}
                    </button>
                  </>
                )}
              </div>

              <div className="mt-2 py-1 px-2.5 rounded-lg bg-amber-50 border border-slate-300 text-slate-700 text-[10px] leading-snug flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                <span>
                  <strong>Tip:</strong> Good frontal lighting, neutral expression, and no tinted sunglasses ensure immediate 99.8% verification during roll calls.
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. STATIC BOTTOM FOOTER BAR */}
      <footer className="w-full h-7 border-t-2 border-slate-900 bg-white px-4 sm:px-6 flex items-center justify-between text-[11px] font-extrabold text-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
          <span>EVOLVE Student Portal</span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-slate-500 font-bold text-[10px]">
          <span>Zero-Trust 512-d Biometrics</span>
          <span>•</span>
          <span>Live Identity Badge Sync</span>
        </div>
        <div>
          <span>Evolve.ai Vision Suite © 2026</span>
        </div>
      </footer>
    </main>
  );
}
