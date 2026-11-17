const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export interface UserProfile {
  id: string;
  email: string;
  role: "student" | "teacher" | "admin";
  status: string;
  name: string;
  entity_id?: string;
}

export interface StudentProfile {
  id?: string;
  urn?: string;
  full_name?: string;
  email?: string;
  division_name?: string;
  semester?: number;
  academic_year?: string;
  roll_number?: string;
  institution?: string;
}

export interface TeacherOffering {
  offering_id: string;
  subject_code: string;
  subject_name: string;
  division_id: string;
  division_name: string;
  branch_code: string;
  department_name: string;
  academic_year: string;
  semester: number;
  enrolled_students_count: number;
}

export interface AttendanceProposalItem {
  record_id?: string;
  student_id: string;
  urn: string;
  full_name: string;
  roll_number?: string;
  proposed_status: "present" | "absent" | "late" | "excused";
  similarity?: number | null;
  review_state: "accepted" | "needs_review" | "not_detected" | "corrected";
  marking_method: string;
  correction_reason?: string;
}

export interface SessionProposalsResponse {
  session_id: string;
  offering_id: string;
  subject_code: string;
  subject_name: string;
  division_name: string;
  session_date: string;
  status: string;
  summary: {
    total_enrolled: number;
    likely_matches: number;
    needs_review: number;
    not_detected: number;
    unidentified_faces: number;
    detected_faces_total?: number;
  };
  proposals: AttendanceProposalItem[];
}

export interface AttendanceSessionSummary {
  id: string;
  offering_id: string;
  subject_name: string;
  subject_code: string;
  division_name: string;
  session_date: string;
  status: string;
  total_enrolled: number;
  present_count: number;
  absent_count: number;
  confirmed_at?: string;
}

export interface OfferingRosterStudent {
  student_id: string;
  urn: string;
  full_name: string;
  roll_number: string;
  total_classes: number;
  attended_classes: number;
  attendance_percentage: number | null;
  is_at_risk: boolean;
  status: string;
}

export interface OfferingRosterResponse {
  offering_id: string;
  subject_code: string;
  subject_name: string;
  division_name: string;
  semester: number;
  total_classes_held: number;
  total_students: number;
  at_risk_count: number;
  on_track_count: number;
  students: OfferingRosterStudent[];
}

export interface StudentDashboardData {
  student_id: string;
  full_name: string;
  urn: string;
  division_name?: string;
  semester?: number;
  academic_year?: string;
  roll_number?: string;
  overall_percentage: number;
  total_classes: number;
  attended_classes: number;
  safe_missable_classes?: number;
  recovery_classes_needed?: number;
  subject_summaries: {
    subject_code: string;
    subject_name: string;
    total_classes: number;
    attended_classes: number;
    attendance_percentage: number;
    safe_missable_classes?: number;
    recovery_classes_needed?: number;
  }[];
  recent_records: {
    session_id: string;
    subject_code: string;
    subject_name: string;
    session_date: string;
    status: string;
    marking_method: string;
    review_state: string;
  }[];
}

export interface AuditLogItem {
  id: string;
  session_id: string;
  student_urn: string;
  student_name: string;
  actor_email: string;
  actor_role: string;
  old_status: string;
  new_status: string;
  reason: string;
  timestamp: string;
}

class ApiClient {
  private getToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("snapclass_token");
    }
    return null;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      if (res.status === 401) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("snapclass_token");
          localStorage.removeItem("snapclass_user");
          try {
            sessionStorage.removeItem("snapclass_student_cache");
          } catch {}
          if (!window.location.pathname.startsWith("/login") && window.location.pathname !== "/") {
            const role = window.location.pathname.includes("teacher") ? "teacher" : "student";
            window.location.href = `/login?role=${role}&expired=1`;
          }
        }
      }
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Request failed");
    }

    return res.json();
  }

  // Auth
  async login(email: string, password: string) {
    const res = await this.request<{
      access_token: string;
      role: string;
      email: string;
      name: string;
      profile_id: string;
      entity_id?: string;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (typeof window !== "undefined") {
      localStorage.setItem("snapclass_token", res.access_token);
      localStorage.setItem("snapclass_user", JSON.stringify(res));
    }
    return res;
  }

  async getMe(): Promise<UserProfile> {
    return this.request<UserProfile>("/auth/me");
  }

  // Students
  async registerStudent(data: any) {
    return this.request("/students/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async enrollFace(formData: FormData) {
    return this.request("/students/face-enrollment", {
      method: "POST",
      body: formData,
    });
  }

  async getStudentProfile(): Promise<StudentProfile> {
    return this.request<StudentProfile>("/students/me");
  }

  async getStudentAttendance(): Promise<StudentDashboardData> {
    return this.request<StudentDashboardData>("/students/me/attendance");
  }

  // Teachers
  async registerTeacher(data: {
    email: string;
    password: string;
    faculty_id: string;
    full_name: string;
    department_name?: string;
    designation?: string;
    course_name?: string;
    branch_code?: string;
    subject_code?: string;
    subject_name?: string;
    division_name?: string;
    semester?: number;
    academic_year?: string;
  }) {
    return this.request("/teachers/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async createCustomOffering(data: {
    course_name?: string;
    branch_code?: string;
    subject_code: string;
    subject_name: string;
    division_name?: string;
    semester?: number;
    academic_year?: string;
  }): Promise<TeacherOffering> {
    return this.request<TeacherOffering>("/teachers/offerings/custom", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getTeacherOfferings(): Promise<TeacherOffering[]> {
    return this.request<TeacherOffering[]>("/teachers/me/offerings");
  }

  async removeTeacherOffering(offeringId: string): Promise<{ message: string; offering_id: string }> {
    return this.request<{ message: string; offering_id: string }>(`/teachers/offerings/${offeringId}`, {
      method: "DELETE",
    });
  }

  async getTeacherRecentSessions(): Promise<AttendanceSessionSummary[]> {
    return this.request<AttendanceSessionSummary[]>("/teachers/me/sessions");
  }

  async getOfferingRoster(offeringId: string): Promise<OfferingRosterResponse> {
    return this.request<OfferingRosterResponse>(`/teachers/offerings/${offeringId}/roster`);
  }

  // Attendance Sessions
  async createSession(offeringId: string, sessionDate?: string) {
    return this.request<{ session_id: string; offering_id: string; status: string }>("/attendance/sessions", {
      method: "POST",
      body: JSON.stringify({ offering_id: offeringId, session_date: sessionDate }),
    });
  }

  async uploadSessionAssets(sessionId: string, files: File[]) {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    return this.request(`/attendance/sessions/${sessionId}/assets`, {
      method: "POST",
      body: formData,
    });
  }

  async processRecognition(sessionId: string): Promise<SessionProposalsResponse> {
    return this.request<SessionProposalsResponse>(`/attendance/sessions/${sessionId}/process`, {
      method: "POST",
    });
  }

  async getProposals(sessionId: string): Promise<SessionProposalsResponse> {
    return this.request<SessionProposalsResponse>(`/attendance/sessions/${sessionId}/proposals`);
  }

  async updateRecords(sessionId: string, updates: { student_id: string; status: string; reason: string }[]) {
    return this.request(`/attendance/sessions/${sessionId}/records`, {
      method: "PATCH",
      body: JSON.stringify({ updates }),
    });
  }

  async confirmSession(sessionId: string) {
    return this.request(`/attendance/sessions/${sessionId}/confirm`, {
      method: "POST",
    });
  }

  getExportUrl(sessionId: string) {
    return `${API_BASE}/attendance/sessions/${sessionId}/export`;
  }

  // Admin
  async getAuditLogs(limit: number = 50): Promise<AuditLogItem[]> {
    return this.request<AuditLogItem[]>(`/admin/audit?limit=${limit}`);
  }

  async getAdminStats() {
    return this.request("/admin/stats");
  }
}

export const api = new ApiClient();

