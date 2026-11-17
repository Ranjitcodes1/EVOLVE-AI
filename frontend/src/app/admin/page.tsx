"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, AuditLogItem } from "@/lib/api";
import {
  ShieldCheck,
  Users,
  BookOpen,
  Calendar,
  AlertCircle,
  FileText,
  Clock,
  ArrowRight,
  Filter,
} from "lucide-react";

export default function AdminConsolePage() {
  const [stats, setStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAdminData() {
      try {
        const [statsRes, auditRes] = await Promise.all([
          api.getAdminStats(),
          api.getAuditLogs(50),
        ]);
        setStats(statsRes);
        setAuditLogs(auditRes);
      } catch (err: any) {
        setError(err.message || "Failed to load admin audit records");
      } finally {
        setLoading(false);
      }
    }
    loadAdminData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-slate-500">
        Loading institutional administration and audit records...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm mb-8">
        <div>
          <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold tracking-wide uppercase border border-purple-200">
            System Administration
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
            Institutional Audit & Compliance Console
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Department of Computer Science & Engineering • System Audit Trail
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-800 text-xs font-semibold border border-purple-200">
            <ShieldCheck className="h-4 w-4 text-purple-600" />
            Immutable Audit Trail Active
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Overview Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Active Students
              </span>
              <Users className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{stats.total_students}</p>
            <p className="text-[11px] text-slate-500 mt-1">Division A enrolled</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Faculty Members
              </span>
              <Users className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{stats.total_teachers}</p>
            <p className="text-[11px] text-slate-500 mt-1">CSE Department</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Academic Offerings
              </span>
              <BookOpen className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{stats.total_offerings}</p>
            <p className="text-[11px] text-slate-500 mt-1">CS201, CS202, CS203</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Confirmed Sessions
              </span>
              <Calendar className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{stats.confirmed_sessions}</p>
            <p className="text-[11px] text-slate-500 mt-1">Permanently archived</p>
          </div>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" />
              Manual Correction Audit History
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Traceable log of all faculty and admin attendance modifications with mandatory reasons
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {auditLogs.length} Records Logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Student & URN</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Status Change</th>
                <th className="py-3 px-4">Mandatory Justification Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No manual corrections recorded yet. AI proposals confirmed directly.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{log.student_name}</p>
                      <p className="text-[11px] font-mono text-slate-400">{log.student_urn}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-800">{log.actor_email}</p>
                      <p className="text-[10px] text-slate-400 capitalize">{log.actor_role}</p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold uppercase text-[10px]">
                        {log.old_status}
                      </span>
                      <span className="mx-1 text-slate-400">→</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold uppercase text-[10px]">
                        {log.new_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-[11px] italic">
                        "{log.reason}"
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

