"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Camera, Sparkles, Building2, User, Check, Briefcase } from "lucide-react";

export type TeacherCardData = {
  institution: string;
  facultyId: string;
  fullName: string;
  department: string;
  designation: string;
  course: string;
  branchCode: string;
  subjectCode: string;
  subjectName: string;
  division: string;
  semester: number;
  academicYear: string;
  email: string;
  pin: string;
  photoPreview?: string | null;
};

export type TeacherCardValidity = {
  institution: boolean;
  facultyId: boolean;
  fullName: boolean;
  department: boolean;
  designation: boolean;
  course: boolean;
  subjectCode: boolean;
  subjectName: boolean;
  division: boolean;
  semester: boolean;
  email: boolean;
  pin: boolean;
  allValid: boolean;
};

type Props = {
  defaultValues?: Partial<TeacherCardData>;
  photoPreview?: string | null;
  onPhotoClick?: () => void;
  onPhotoChange?: (file: File, previewUrl: string) => void;
  badgeOnly?: boolean;
  showSubmit?: boolean;
  submitLabel?: string;
  isLoading?: boolean;
  onChange?: (data: TeacherCardData, validity: TeacherCardValidity) => void;
  onSubmit?: (data: TeacherCardData, validity: TeacherCardValidity) => void;
  className?: string;
};

// Generates dynamic barcode line pattern from Faculty ID
function generateBarcodeLines(id: string) {
  const seed = id || "FAC-2026-104";
  const lines: { width: number; space: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const charCode = seed.charCodeAt(i % seed.length) || 48;
    const width = (charCode % 3) + 1.2;
    const space = ((charCode * 3) % 3) + 1.5;
    lines.push({ width, space });
  }
  return lines;
}

export const TeacherIdCardForm = ({
  defaultValues,
  photoPreview,
  onPhotoClick,
  onPhotoChange,
  badgeOnly = false,
  showSubmit = true,
  submitLabel = "Save Faculty Badge & Launch Studio →",
  isLoading = false,
  onChange,
  onSubmit,
  className = "",
}: Props) => {
  const [institution, setInstitution] = useState(defaultValues?.institution || "");
  const [facultyId, setFacultyId] = useState(defaultValues?.facultyId || "");
  const [fullName, setFullName] = useState(defaultValues?.fullName || "");
  const [department, setDepartment] = useState(defaultValues?.department || "Computer Science");
  const [designation, setDesignation] = useState(defaultValues?.designation || "Assistant Professor");
  const [course, setCourse] = useState(defaultValues?.course || "Computer Science & Engineering");
  const [branchCode, setBranchCode] = useState(defaultValues?.branchCode || "CSE");
  const [subjectCode, setSubjectCode] = useState(defaultValues?.subjectCode || "CS301");
  const [subjectName, setSubjectName] = useState(defaultValues?.subjectName || "Computer Networks");
  const [division, setDivision] = useState(defaultValues?.division || "A");
  const [semester, setSemester] = useState(defaultValues?.semester || 3);
  const [academicYear, setAcademicYear] = useState(defaultValues?.academicYear || "2026-2027");
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
  const validity: TeacherCardValidity = useMemo(() => {
    const instValid = institution.trim().length >= 2;
    const facIdValid = facultyId.trim().length >= 3;
    const nameValid = fullName.trim().length >= 3;
    const deptValid = !!department;
    const desigValid = !!designation;
    const courseValid = course.trim().length >= 2;
    const sCodeValid = subjectCode.trim().length >= 2;
    const sNameValid = subjectName.trim().length >= 2;
    const divValid = division.trim().length >= 1;
    const semValid = semester >= 1 && semester <= 8;
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length >= 5;
    const pinValid = pin.length >= 4;

    return {
      institution: instValid,
      facultyId: facIdValid,
      fullName: nameValid,
      department: deptValid,
      designation: desigValid,
      course: courseValid,
      subjectCode: sCodeValid,
      subjectName: sNameValid,
      division: divValid,
      semester: semValid,
      email: emailValid,
      pin: pinValid,
      allValid:
        instValid &&
        facIdValid &&
        nameValid &&
        deptValid &&
        desigValid &&
        courseValid &&
        sCodeValid &&
        sNameValid &&
        divValid &&
        semValid &&
        emailValid &&
        pinValid,
    };
  }, [
    institution,
    facultyId,
    fullName,
    department,
    designation,
    course,
    subjectCode,
    subjectName,
    division,
    semester,
    email,
    pin,
  ]);

  // Live change callback
  useEffect(() => {
    onChange?.(
      {
        institution,
        facultyId,
        fullName,
        department,
        designation,
        course,
        branchCode,
        subjectCode,
        subjectName,
        division,
        semester,
        academicYear,
        email,
        pin,
        photoPreview: activePhoto,
      },
      validity
    );
  }, [
    institution,
    facultyId,
    fullName,
    department,
    designation,
    course,
    branchCode,
    subjectCode,
    subjectName,
    division,
    semester,
    academicYear,
    email,
    pin,
    activePhoto,
    validity,
    onChange,
  ]);

  const barcodeBars = useMemo(() => generateBarcodeLines(facultyId), [facultyId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(
      {
        institution,
        facultyId,
        fullName,
        department,
        designation,
        course,
        branchCode,
        subjectCode,
        subjectName,
        division,
        semester,
        academicYear,
        email,
        pin,
        photoPreview: activePhoto,
      },
      validity
    );
  };

  // Compact Faculty Lanyard Badge Markup
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

      {/* LANYARD STRAP ASSEMBLY (Prestigious Gold/Amber Ribbon) */}
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

        {/* TOP SECTION: DIAGONAL AMBER/GOLD STRIPES + INSTITUTION NAME BANNER */}
        <div className="badge-top-banner">
          <div className="badge-stripes" />
          <div className="badge-institution-header" title={institution}>
            {institution || "INSTITUTION / UNIVERSITY"}
          </div>
        </div>

        {/* CIRCULAR PHOTO PORTAL */}
        <div
          className={`badge-photo-portal ${activePhoto ? "has-photo" : ""}`}
          onClick={handlePortalClick}
          title={activePhoto ? "Faculty portrait active — click to change" : "Click to upload portrait photo"}
        >
          {activePhoto ? (
            <div className="relative w-full h-full group">
              <img src={activePhoto} alt="Faculty Portrait" className="w-full h-full object-cover" />
              <div className="photo-overlay-tag" style={{ background: "#f59e0b" }}>
                <Check className="w-3 h-3 text-slate-950 stroke-[3]" />
              </div>
            </div>
          ) : (
            <div className="photo-placeholder-empty">
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-0.5">
                <User className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-[8px] font-black text-amber-400 tracking-wider uppercase">Portrait</span>
              <div className="photo-overlay-tag">
                <Camera className="w-2.5 h-2.5 text-slate-950" />
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM SECTION: SLEEK OBSIDIAN CARD BODY */}
        <div className="badge-body">
          {/* Department Eyebrow */}
          <div className="badge-institution-eyebrow" title={department}>
            {department ? `FACULTY OF ${department.toUpperCase()}` : "FACULTY OF ENGINEERING"}
          </div>

          {/* Faculty Full Name & Title */}
          <h3 className="badge-name" title={fullName}>
            {fullName || "FACULTY FULL NAME"}
          </h3>

          {/* Academic Designation */}
          <p className="badge-role">
            {designation || "Faculty Member"}
          </p>

          {/* Subtitle / Organization chip */}
          <p className="badge-institution">
            EVOLVE • FACULTY • {facultyId || "FAC-ID"}
          </p>

          {/* Live Academic Subject & Division Tag */}
          <div className="flex flex-col items-center gap-1 my-1">
            <span
              className="text-[7.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 text-center max-w-[190px] truncate"
              title={`${subjectCode} - ${subjectName}`}
            >
              {subjectCode || "CS301"} • {subjectName || "Computer Networks"}
            </span>
            <span className="text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Div {division || "—"} • Sem {semester || "—"} • {branchCode || "—"}
            </span>
          </div>

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
            <div className="badge-urn-text">{facultyId || "FAC-BARCODE"}</div>
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
          <Camera className="w-3 h-3 text-amber-500" />
          {activePhoto ? "Change Photo" : "Upload Portrait"}
        </button>
      </div>

      <p className="text-center text-[10px] text-slate-500 mt-1 flex items-center justify-center gap-1 font-semibold">
        <Sparkles className="w-2.5 h-2.5 text-amber-500" />
        Faculty Smart Badge • 3D Tilt On Hover
      </p>
    </div>
  );

  if (badgeOnly) {
    return (
      <div className={`teacher-badge-solo ${className}`}>
        {renderBadge()}
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <section className={`teacher-badge-container ${className}`}>
      <div className="badge-form-grid">
        {/* LEFT COLUMN: THE REALISTIC LANYARD FACULTY BADGE */}
        <div className="badge-preview-column">
          {renderBadge()}
        </div>

        {/* RIGHT COLUMN: DETAILS FORM */}
        <div className="form-column">
          <form className="badge-form" onSubmit={handleSubmit} noValidate>
            <div className="border-b border-slate-100 pb-2 mb-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-amber-100 border border-slate-900 text-slate-900 flex items-center justify-center font-black text-[10px] shadow-[1px_1px_0_#0d0d0d]">
                    FAC
                  </span>
                  <h2 className="text-sm font-black text-slate-900 tracking-tight">Faculty Identity Details</h2>
                </div>
                <span className="text-[10px] font-bold text-slate-400">Syncs live with badge</span>
              </div>
            </div>

            {/* 1. INSTITUTION NAME (FULL WIDTH AT TOP) */}
            <div>
              <label htmlFor="institution" className="flex items-center gap-1">
                <Building2 className="w-3 h-3 text-amber-600" />
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
            </div>

            {/* 2. FULL NAME & FACULTY EMPLOYEE ID (2 COLUMNS) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="fullName">Full Name (With Title)</label>
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. Dr. Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  aria-invalid={!validity.fullName}
                />
              </div>

              <div>
                <label htmlFor="facultyId">Faculty Employee ID (Barcode)</label>
                <input
                  id="facultyId"
                  type="text"
                  placeholder="e.g. FAC-2026-101"
                  value={facultyId}
                  onChange={(e) => setFacultyId(e.target.value)}
                  aria-invalid={!validity.facultyId}
                />
              </div>
            </div>

            {/* 3. DEPARTMENT & DESIGNATION (2 COLUMNS) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="department">Academic Department</label>
                <select
                  id="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option value="Computer Science">Computer Science & Eng</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Electronics & Comm">Electronics & Comm</option>
                  <option value="Mechanical Eng">Mechanical Engineering</option>
                  <option value="Civil Engineering">Civil Engineering</option>
                </select>
              </div>

              <div>
                <label htmlFor="designation">Academic Designation</label>
                <select
                  id="designation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                >
                  <option value="Assistant Professor">Assistant Professor</option>
                  <option value="Associate Professor">Associate Professor</option>
                  <option value="Professor">Professor</option>
                  <option value="Head of Department">Head of Department (HOD)</option>
                  <option value="Dean of Faculty">Dean of Faculty</option>
                </select>
              </div>
            </div>

            {/* 4. COURSE & BRANCH / PROGRAM (2 COLUMNS - SELECT OR TYPE) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="course">Course / Degree Program</label>
                <input
                  id="course"
                  type="text"
                  list="course-suggestions"
                  placeholder="e.g. Computer Science & Engineering"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  aria-invalid={!validity.course}
                />
                <datalist id="course-suggestions">
                  <option value="Computer Science & Engineering" />
                  <option value="Information Technology" />
                  <option value="Artificial Intelligence & Data Science" />
                  <option value="Electronics & Communication" />
                  <option value="Mechanical Engineering" />
                  <option value="Master of Computer Applications (MCA)" />
                  <option value="Bachelor of Computer Applications (BCA)" />
                </datalist>
              </div>

              <div>
                <label htmlFor="branchCode">Branch / Course Code</label>
                <input
                  id="branchCode"
                  type="text"
                  placeholder="e.g. CSE"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                  aria-invalid={!validity.course}
                />
              </div>
            </div>

            {/* 5. PRIMARY SUBJECT CODE & TITLE (2 COLUMNS - SELECT OR TYPE) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="subjectCode">Subject Code</label>
                <input
                  id="subjectCode"
                  type="text"
                  list="subject-code-suggestions"
                  placeholder="e.g. CS302"
                  value={subjectCode}
                  onChange={(e) => setSubjectCode(e.target.value.toUpperCase())}
                  aria-invalid={!validity.subjectCode}
                />
                <datalist id="subject-code-suggestions">
                  <option value="CS301" />
                  <option value="CS302" />
                  <option value="CS303" />
                  <option value="CS304" />
                  <option value="CS305" />
                  <option value="CS306" />
                  <option value="AI401" />
                </datalist>
              </div>

              <div>
                <label htmlFor="subjectName">Subject Title</label>
                <input
                  id="subjectName"
                  type="text"
                  list="subject-name-suggestions"
                  placeholder="e.g. Computer Networks"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  aria-invalid={!validity.subjectName}
                />
                <datalist id="subject-name-suggestions">
                  <option value="Computer Networks" />
                  <option value="Database Management Systems" />
                  <option value="Design & Analysis of Algorithms" />
                  <option value="Operating Systems" />
                  <option value="Software Engineering" />
                  <option value="Cloud Computing" />
                  <option value="Machine Learning" />
                </datalist>
              </div>
            </div>

            {/* 6. DIVISION & SEMESTER (2 COLUMNS - SELECT OR TYPE) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="division">Assigned Class Division</label>
                <input
                  id="division"
                  type="text"
                  list="division-suggestions"
                  placeholder="e.g. A"
                  value={division}
                  onChange={(e) => setDivision(e.target.value.toUpperCase())}
                  aria-invalid={!validity.division}
                />
                <datalist id="division-suggestions">
                  <option value="A" />
                  <option value="B" />
                  <option value="C" />
                  <option value="Morning Batch" />
                </datalist>
              </div>

              <div>
                <label htmlFor="semester">Class Semester</label>
                <select
                  id="semester"
                  value={semester}
                  onChange={(e) => setSemester(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 7. INSTITUTIONAL EMAIL & ACADEMIC YEAR (2 COLUMNS) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="email">Faculty Email Address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="faculty@university.edu"
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

            {/* 5. SECURITY PASSWORD (FULL WIDTH) */}
            <div>
              <label htmlFor="pin">Portal Password / Security PIN</label>
              <input
                id="pin"
                type="password"
                placeholder="••••••••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                aria-invalid={!validity.pin}
              />
            </div>

            {showSubmit && (
              <button
                className="badge-submit-btn"
                type="submit"
                disabled={!validity.allValid || isLoading}
                aria-disabled={!validity.allValid || isLoading}
              >
                {isLoading ? "Saving Badge..." : validity.allValid ? submitLabel : "Complete all fields to proceed"}
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
  .teacher-badge-container,
  .teacher-badge-solo {
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

  /* Woven textured amber/gold ribbon */
  .lanyard-ribbon {
    width: 18px;
    height: 32px;
    background-color: #d97706;
    background-image: 
      repeating-linear-gradient(45deg, rgba(255,255,255,0.25) 0, rgba(255,255,255,0.25) 2px, transparent 2px, transparent 4px),
      repeating-linear-gradient(-45deg, rgba(0,0,0,0.2) 0, rgba(0,0,0,0.2) 2px, transparent 2px, transparent 4px);
    box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0,0,0,0.2);
    border-left: 1px solid rgba(0,0,0,0.2);
    border-right: 1px solid rgba(0,0,0,0.2);
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

  /* TOP BANNER: AMBER/GOLD DIAGONAL STRIPES + INSTITUTION NAME */
  .badge-top-banner {
    width: 100%;
    height: 72px;
    background: #d97706;
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
      #b45309,
      #b45309 8px,
      #f59e0b 8px,
      #f59e0b 16px
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
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
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
    border-color: #f59e0b;
  }

  .badge-photo-portal.has-photo {
    border-color: #f59e0b;
    box-shadow: 0 0 16px rgba(245, 158, 11, 0.45);
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
    background: #f59e0b;
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
    color: #fbbf24;
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
    color: #cbd5e1;
    font-size: 10.5px;
    font-weight: 600;
    margin: 2px 0 0;
    line-height: 1.2;
    max-width: 200px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .badge-institution {
    color: #94a3b8;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    margin: 4px 0 0;
    opacity: 0.9;
  }

  .badge-divider {
    width: 82%;
    border-top: 1.5px dashed rgba(255, 255, 255, 0.18);
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
    color: #f8fafc;
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
    border-color: #d97706;
    background-color: #ffffff;
    box-shadow: 2.5px 2.5px 0 #f59e0b;
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
    background: #f59e0b;
    color: #0f172a;
    font-weight: 900;
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
    background: #fbbf24;
  }

  .badge-submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #94a3b8;
    box-shadow: 1.5px 1.5px 0 #0f172a;
  }
`;

