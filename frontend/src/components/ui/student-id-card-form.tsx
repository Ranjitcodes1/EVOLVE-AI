"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Camera, Sparkles, Building2, User, Check } from "lucide-react";

export type StudentCardData = {
  institution: string;
  urn: string;
  fullName: string;
  department: string;
  branch: string;
  division: string;
  semester: number;
  academicYear: string;
  rollNumber: string;
  email: string;
  pin: string;
  photoPreview?: string | null;
};

export type StudentCardValidity = {
  institution: boolean;
  urn: boolean;
  fullName: boolean;
  department: boolean;
  division: boolean;
  email: boolean;
  pin: boolean;
  allValid: boolean;
};

type Props = {
  defaultValues?: Partial<StudentCardData>;
  photoPreview?: string | null;
  onPhotoClick?: () => void;
  onPhotoChange?: (file: File, previewUrl: string) => void;
  badgeOnly?: boolean;
  showSubmit?: boolean;
  submitLabel?: string;
  isLoading?: boolean;
  onChange?: (data: StudentCardData, validity: StudentCardValidity) => void;
  onSubmit?: (data: StudentCardData, validity: StudentCardValidity) => void;
  className?: string;
};

// Generates dynamic barcode line pattern from URN
function generateBarcodeLines(urn: string) {
  const seed = urn || "139811973";
  const lines: { width: number; space: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const charCode = seed.charCodeAt(i % seed.length) || 48;
    const width = (charCode % 3) + 1.2;
    const space = ((charCode * 3) % 3) + 1.5;
    lines.push({ width, space });
  }
  return lines;
}

export const StudentIdCardForm = ({
  defaultValues,
  photoPreview,
  onPhotoClick,
  onPhotoChange,
  badgeOnly = false,
  showSubmit = true,
  submitLabel = "Save Identity & Proceed to Face Scan →",
  isLoading = false,
  onChange,
  onSubmit,
  className = "",
}: Props) => {
  const [institution, setInstitution] = useState(defaultValues?.institution || "");
  const [urn, setUrn] = useState(defaultValues?.urn || "");
  const [fullName, setFullName] = useState(defaultValues?.fullName || "");
  const [department, setDepartment] = useState(defaultValues?.department || "Computer Science");
  const [branch, setBranch] = useState(defaultValues?.branch || "CSE");
  const [division, setDivision] = useState(defaultValues?.division || "A");
  const [semester, setSemester] = useState(defaultValues?.semester || 3);
  const [academicYear, setAcademicYear] = useState(defaultValues?.academicYear || "2026-2027");
  const [rollNumber, setRollNumber] = useState(defaultValues?.rollNumber || "");
  const [email, setEmail] = useState(defaultValues?.email || "");
  const [pin, setPin] = useState(defaultValues?.pin || "");

  const [internalPhoto, setInternalPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activePhoto = photoPreview !== undefined ? photoPreview : internalPhoto;

  const handlePortalClick = () => {
    if (onPhotoClick) {
      onPhotoClick();
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleInternalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const preview = URL.createObjectURL(file);
      setInternalPhoto(preview);
      onPhotoChange?.(file, preview);
    }
  };

  // Subtle interactive 3D physics on mouse move over the badge
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, rz: 0 });
  const cardRef = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rx = -(y / rect.height) * 12;
    const ry = (x / rect.width) * 12;
    const rz = (x / rect.width) * 2;
    setTilt({ rx, ry, rz });
  };

  const handleMouseLeave = () => {
    setTilt({ rx: 0, ry: 0, rz: 0 });
  };

  // Validation
  const validity: StudentCardValidity = useMemo(() => {
    const instValid = institution.trim().length >= 2;
    const urnValid = urn.trim().length >= 4;
    const nameValid = fullName.trim().length >= 2;
    const deptValid = !!department;
    const divValid = !!division;
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length >= 5;
    const pinValid = pin.length >= 4;

    return {
      institution: instValid,
      urn: urnValid,
      fullName: nameValid,
      department: deptValid,
      division: divValid,
      email: emailValid,
      pin: pinValid,
      allValid: instValid && urnValid && nameValid && deptValid && divValid && emailValid && pinValid,
    };
  }, [institution, urn, fullName, department, division, email, pin]);

  // Live change callback
  useEffect(() => {
    onChange?.(
      {
        institution,
        urn,
        fullName,
        department,
        branch,
        division,
        semester,
        academicYear,
        rollNumber,
        email,
        pin,
        photoPreview: activePhoto,
      },
      validity
    );
  }, [institution, urn, fullName, department, branch, division, semester, academicYear, rollNumber, email, pin, activePhoto, validity, onChange]);

  const barcodeBars = useMemo(() => generateBarcodeLines(urn), [urn]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(
      {
        institution,
        urn,
        fullName,
        department,
        branch,
        division,
        semester,
        academicYear,
        rollNumber,
        email,
        pin,
        photoPreview: activePhoto,
      },
      validity
    );
  };

  // Compact Lanyard Badge Markup
  const renderBadge = () => (
    <div
      className="lanyard-stage"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      ref={cardRef}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInternalFileChange}
      />

      {/* LANYARD STRAP ASSEMBLY */}
      <div className="lanyard-strap-assembly">
        <div className="lanyard-ribbon" />
        <div className="lanyard-crimp" />
        <div className="lanyard-reel">
          <div className="lanyard-reel-inner" />
        </div>
        <div className="lanyard-clip" />
      </div>

      {/* THE VERTICAL BADGE CARD */}
      <div
        className="badge-card"
        style={{
          transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) rotateZ(${tilt.rz}deg)`,
        }}
      >
        {/* Slot hole punched through the card */}
        <div className="badge-slot-hole" />

        {/* TOP SECTION: DIAGONAL PINK STRIPES + INSTITUTION NAME BANNER */}
        <div className="badge-top-banner">
          <div className="badge-stripes" />
          <div className="badge-institution-header" title={institution}>
            {institution || "EVOLVE INSTITUTE OF TECHNOLOGY"}
          </div>
        </div>

        {/* CIRCULAR PHOTO PORTAL (HOLDS THE STUDENT'S REAL TAKEN PHOTO) */}
        <div
          className={`badge-photo-portal ${activePhoto ? "has-photo" : ""}`}
          onClick={handlePortalClick}
          title={activePhoto ? "Student photo active — click to change" : "Click to snap or upload reference photo"}
        >
          {activePhoto ? (
            <div className="relative w-full h-full group">
              <img src={activePhoto} alt="Student Face" className="w-full h-full object-cover" />
              <div className="photo-overlay-tag" style={{ background: "#10b981" }}>
                <Check className="w-3 h-3 text-white stroke-[3]" />
              </div>
            </div>
          ) : (
            <div className="photo-placeholder-empty">
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-0.5">
                <User className="w-4 h-4 text-slate-400" />
              </div>
              <span className="text-[8px] font-black text-rose-400 tracking-wider uppercase">Photo Needed</span>
              <div className="photo-overlay-tag">
                <Camera className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM SECTION: SLEEK OBSIDIAN CARD BODY */}
        <div className="badge-body">
          {/* Institution Eyebrow */}
          <div className="badge-institution-eyebrow" title={institution}>
            {institution || "INSTITUTION / UNIVERSITY"}
          </div>

          {/* Student Full Name */}
          <h3 className="badge-name" title={fullName}>
            {fullName || "STUDENT FULL NAME"}
          </h3>

          {/* Department / Role */}
          <p className="badge-role">
            {department ? (department.includes("CSE") || department.includes("Computer") ? "Computer Science & Engineering" : department) : "Department"}
          </p>

          {/* Subtitle / Organization chip */}
          <p className="badge-institution">
            EVOLVE • {branch || "CSE"} • DIV {division || "—"}
          </p>

          {/* Spacer to push barcode to bottom */}
          <div className="flex-1 min-h-[6px]" />

          {/* Dotted separation line */}
          <div className="badge-divider" />

          {/* Barcode & ID Number */}
          <div className="badge-barcode-area">
            <svg className="badge-barcode" viewBox="0 0 140 22" preserveAspectRatio="none">
              {barcodeBars.map((bar, i) => (
                <rect
                  key={i}
                  x={i * 4.4}
                  y={0}
                  width={bar.width}
                  height={22}
                  fill="#ffffff"
                  opacity={0.92}
                />
              ))}
            </svg>
            <div className="badge-urn-text">{urn || "STUDENT-URN"}</div>
          </div>
        </div>
      </div>

      {/* Button to Snap / Upload Photo */}
      <div className="flex items-center justify-center gap-1.5 mt-2">
        <button
          type="button"
          onClick={handlePortalClick}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-900 shadow-[1.5px_1.5px_0_#0d0d0d] text-[10px] font-black text-slate-900 hover:bg-slate-50 transition"
        >
          <Camera className="w-3 h-3 text-rose-500" />
          {activePhoto ? "Change Photo" : "Upload / Snap Photo"}
        </button>
      </div>

      <p className="text-center text-[10px] text-slate-500 mt-1 flex items-center justify-center gap-1 font-semibold">
        <Sparkles className="w-2.5 h-2.5 text-rose-500" />
        Interactive Identity Badge • 3D Tilt On Hover
      </p>
    </div>
  );

  if (badgeOnly) {
    return (
      <div className={`student-badge-solo ${className}`}>
        {renderBadge()}
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <section className={`student-badge-container ${className}`}>
      <div className="badge-form-grid">
        {/* LEFT COLUMN: THE REALISTIC LANYARD IDENTITY CARD */}
        <div className="badge-preview-column">
          {renderBadge()}
        </div>

        {/* RIGHT COLUMN: DETAILS FORM */}
        <div className="form-column">
          <form className="badge-form" onSubmit={handleSubmit} noValidate>
            <div className="border-b border-slate-100 pb-2 mb-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-rose-100 border border-slate-900 text-rose-600 flex items-center justify-center font-black text-[10px] shadow-[1px_1px_0_#0d0d0d]">
                    ID
                  </span>
                  <h2 className="text-sm font-black text-slate-900 tracking-tight">Student Identity Details</h2>
                </div>
                <span className="text-[10px] font-bold text-slate-400">Syncs live with badge</span>
              </div>
            </div>

            {/* 1. INSTITUTION NAME (FULL WIDTH AT TOP OF NAME) */}
            <div>
              <label htmlFor="institution" className="flex items-center gap-1">
                <Building2 className="w-3 h-3 text-rose-600" />
                Institution / University Name
              </label>
              <input
                id="institution"
                type="text"
                autoComplete="organization"
                placeholder="e.g. Evolve Institute of Technology"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                aria-invalid={!validity.institution}
              />
              {!validity.institution && institution.length > 0 && (
                <small className="err">Enter institution name</small>
              )}
            </div>

            {/* 2. FULL NAME & STUDENT ID / URN (2 COLUMNS) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="fullName">Full Name (On Badge)</label>
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  aria-invalid={!validity.fullName}
                />
              </div>

              <div>
                <label htmlFor="urn">Student ID / URN (Barcode)</label>
                <input
                  id="urn"
                  type="text"
                  placeholder="e.g. 2026CSE001"
                  value={urn}
                  onChange={(e) => setUrn(e.target.value)}
                  aria-invalid={!validity.urn}
                />
              </div>
            </div>

            {/* 3. DEPARTMENT, DIVISION, SEMESTER (3 COLUMNS) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label htmlFor="department">Department</label>
                <select
                  id="department"
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                    setBranch(e.target.value === "Computer Science" ? "CSE" : e.target.value);
                  }}
                >
                  <option value="Computer Science">Computer Science</option>
                  <option value="Information Technology">Information Tech</option>
                  <option value="Electronics & Comm">Electronics</option>
                  <option value="Mechanical Eng">Mechanical</option>
                  <option value="Civil Engineering">Civil Eng</option>
                </select>
              </div>

              <div>
                <label htmlFor="division">Division</label>
                <select
                  id="division"
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                >
                  <option value="A">Div A</option>
                  <option value="B">Div B</option>
                  <option value="C">Div C</option>
                </select>
              </div>

              <div>
                <label htmlFor="semester">Semester</label>
                <select
                  id="semester"
                  value={semester}
                  onChange={(e) => setSemester(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>
                      Sem {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. EMAIL & ACADEMIC YEAR (2 COLUMNS) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="email">Institutional Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="student@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!validity.email}
                />
              </div>

              <div>
                <label htmlFor="academicYear">Academic Year</label>
                <select
                  id="academicYear"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                >
                  <option value="2025-2026">2025-2026</option>
                  <option value="2026-2027">2026-2027</option>
                  <option value="2027-2028">2027-2028</option>
                </select>
              </div>
            </div>

            {/* 5. ROLL NUMBER & PASSWORD / PIN (2 COLUMNS) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="rollNumber">Class Roll Number</label>
                <input
                  id="rollNumber"
                  type="text"
                  placeholder="e.g. 42"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="pin">Security PIN / Password</label>
                <input
                  id="pin"
                  type="password"
                  placeholder="4-digit PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  aria-invalid={!validity.pin}
                />
              </div>
            </div>

            {showSubmit && (
              <button
                className="badge-submit-btn"
                type="submit"
                disabled={!validity.allValid || isLoading}
                aria-disabled={!validity.allValid || isLoading}
              >
                {isLoading ? "Saving Identity..." : validity.allValid ? submitLabel : "Complete all fields to proceed"}
              </button>
            )}
          </form>
        </div>
      </div>

      <style jsx>{styles}</style>
    </section>
  );
};

const styles = `
  .student-badge-container,
  .student-badge-solo {
    width: 100%;
    display: flex;
    justify-content: center;
    background: transparent;
    user-select: none;
  }

  .badge-form-grid {
    width: 100%;
    max-width: 980px;
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 28px;
    align-items: center;
  }

  @media (max-width: 768px) {
    .badge-form-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }
  }

  /* LANYARD STAGE */
  .lanyard-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    user-select: none;
  }

  /* LANYARD STRAP & HARDWARE */
  .lanyard-strap-assembly {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    z-index: 10;
    margin-bottom: -12px;
  }

  /* Woven textured pink ribbon */
  .lanyard-ribbon {
    width: 18px;
    height: 32px;
    background-color: #ff3366;
    background-image: 
      repeating-linear-gradient(45deg, rgba(255,255,255,0.2) 0, rgba(255,255,255,0.2) 2px, transparent 2px, transparent 4px),
      repeating-linear-gradient(-45deg, rgba(0,0,0,0.15) 0, rgba(0,0,0,0.15) 2px, transparent 2px, transparent 4px);
    box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.35), 0 2px 4px rgba(0,0,0,0.2);
    border-left: 1px solid rgba(0,0,0,0.15);
    border-right: 1px solid rgba(0,0,0,0.15);
  }

  /* Silver crimp band */
  .lanyard-crimp {
    width: 22px;
    height: 6px;
    background: linear-gradient(90deg, #94a3b8, #f8fafc, #64748b);
    border-radius: 2px;
    box-shadow: 0 1.5px 3px rgba(0,0,0,0.3);
    margin-top: -1px;
  }

  /* Silver circular reel button */
  .lanyard-reel {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #ffffff, #cbd5e1 55%, #64748b 90%);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255,255,255,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: -2px;
  }

  .lanyard-reel-inner {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #e2e8f0, #94a3b8);
    border: 1px solid #64748b;
  }

  /* Black metal claw clip */
  .lanyard-clip {
    width: 34px;
    height: 16px;
    background: linear-gradient(180deg, #334155 0%, #0f172a 70%, #020617 100%);
    clip-path: polygon(25% 0%, 75% 0%, 90% 100%, 10% 100%);
    box-shadow: 0 2px 4px rgba(0,0,0,0.4);
    margin-top: -3px;
    z-index: 12;
  }

  /* THE BADGE CARD */
  .badge-card {
    width: 236px;
    height: 346px;
    border-radius: 18px;
    background: #111114;
    box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08);
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.25, 1);
    transform-style: preserve-3d;
  }

  /* Slot hole punched through the card */
  .badge-slot-hole {
    position: absolute;
    top: 7px;
    width: 34px;
    height: 6px;
    border-radius: 4px;
    background: #09090b;
    box-shadow: inset 0 2px 3px rgba(0,0,0,0.8), 0 1px 1px rgba(255,255,255,0.15);
    z-index: 20;
  }

  /* TOP BANNER: PINK DIAGONAL STRIPES + INSTITUTION NAME */
  .badge-top-banner {
    width: 100%;
    height: 72px;
    background: #ff3366;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .badge-stripes {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      -45deg,
      #ff2a5f,
      #ff2a5f 8px,
      #ff4976 8px,
      #ff4976 16px
    );
    opacity: 0.95;
  }

  .badge-institution-header {
    position: relative;
    z-index: 5;
    margin-top: 15px;
    padding: 1px 8px;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #ffffff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
    text-align: center;
    max-width: 90%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* CIRCULAR PHOTO PORTAL */
  .badge-photo-portal {
    position: absolute;
    top: 36px;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    border: 3.5px solid #111114;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    z-index: 15;
    background: #18181b;
    cursor: pointer;
    transition: transform 0.2s ease, border-color 0.2s ease;
  }

  .badge-photo-portal:hover {
    transform: scale(1.03);
    border-color: #ff3366;
  }

  .badge-photo-portal.has-photo {
    border-color: #10b981;
    box-shadow: 0 0 16px rgba(16, 185, 129, 0.45);
  }

  .photo-placeholder-empty {
    width: 100%;
    height: 100%;
    background: #18181b;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
  }

  .photo-placeholder-empty:hover {
    background: #27272a;
  }

  .photo-overlay-tag {
    position: absolute;
    bottom: 3px;
    right: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #ff3366;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1.5px 4px rgba(0,0,0,0.4);
  }

  /* OBSIDIAN CARD BODY */
  .badge-body {
    width: 100%;
    flex: 1;
    background: linear-gradient(180deg, #121215 0%, #0d0d10 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 12px 10px;
    box-sizing: border-box;
    text-align: center;
  }

  .badge-institution-eyebrow {
    color: #fb7185;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 2px;
    max-width: 200px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .badge-name {
    color: #ffffff;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin: 0;
    line-height: 1.15;
    max-width: 200px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .badge-role {
    color: #94a3b8;
    font-size: 10.5px;
    font-weight: 500;
    margin: 2px 0 0;
    line-height: 1.2;
    max-width: 200px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .badge-institution {
    color: #cbd5e1;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    margin: 4px 0 0;
    opacity: 0.85;
  }

  .badge-divider {
    width: 82%;
    border-top: 1.5px dashed rgba(255, 255, 255, 0.15);
    margin-bottom: 6px;
  }

  /* BARCODE AREA */
  .badge-barcode-area {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .badge-barcode {
    width: 140px;
    height: 22px;
    display: block;
  }

  .badge-urn-text {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    color: #e2e8f0;
    font-size: 9px;
    letter-spacing: 0.28em;
    font-weight: 700;
    margin-top: 3px;
  }

  /* DETAILS FORM STYLING */
  .badge-form {
    border-radius: 16px;
    background: #ffffff;
    width: 100%;
    padding: 16px 20px;
    border: 2px solid #0f172a;
    box-shadow: 3.5px 3.5px 0 #0f172a;
    display: grid;
    gap: 8px;
  }

  label {
    display: block;
    margin: 1px 0 2px;
    color: #0f172a;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  input,
  select {
    height: 32px;
    display: block;
    width: 100%;
    border: 1.5px solid #0f172a;
    padding: 4px 10px;
    transition: all 0.15s ease;
    border-radius: 8px;
    outline: none;
    background-color: #f8fafc;
    color: #0f172a;
    font-size: 12px;
    font-weight: 600;
    box-shadow: 1.5px 1.5px 0 #0f172a;
  }

  input:focus,
  select:focus {
    border-color: #ff3366;
    background-color: #ffffff;
    box-shadow: 2.5px 2.5px 0 #ff3366;
  }

  .err {
    color: #e11d48;
    font-size: 10px;
    font-weight: 700;
    margin-top: 2px;
    display: block;
  }

  .badge-submit-btn {
    margin-top: 4px;
    height: 36px;
    border: 2px solid #0f172a;
    border-radius: 10px;
    background: #ff3366;
    color: #ffffff;
    font-weight: 800;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: all 0.15s;
    box-shadow: 2.5px 2.5px 0 #0f172a;
  }

  .badge-submit-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 4px 4px 0 #0f172a;
    background: #e11d48;
  }

  .badge-submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #94a3b8;
    box-shadow: 1.5px 1.5px 0 #0f172a;
  }
`;
