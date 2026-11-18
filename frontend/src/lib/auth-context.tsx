"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, UserProfile } from "./api";

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: (redirectTo?: any) => void;
  quickLogin: (role: "teacher" | "student" | "admin") => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const jsonPayload = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    return payload.exp * 1000 <= Date.now();
  } catch (err) {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Suppress harmless browser media AbortErrors (e.g., play() interrupted by stream reload in React StrictMode)
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (
        reason?.name === "AbortError" ||
        (typeof reason?.message === "string" &&
          reason.message.toLowerCase().includes("interrupted"))
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    const routeRole = path.startsWith("/teacher") ? "teacher" : path.startsWith("/student") ? "student" : path.startsWith("/admin") ? "admin" : null;

    const savedUser = (routeRole && localStorage.getItem(`snapclass_user_${routeRole}`)) || localStorage.getItem("snapclass_user");
    const token = (routeRole && localStorage.getItem(`snapclass_token_${routeRole}`)) || localStorage.getItem("snapclass_token");

    if (savedUser && token) {
      if (isTokenExpired(token)) {
        if (routeRole) {
          localStorage.removeItem(`snapclass_token_${routeRole}`);
          localStorage.removeItem(`snapclass_user_${routeRole}`);
        }
        localStorage.removeItem("snapclass_token");
        localStorage.removeItem("snapclass_user");
        try {
          sessionStorage.removeItem("snapclass_student_cache");
        } catch {}
        setUser(null);
      } else {
        try {
          const parsed = JSON.parse(savedUser);
          setUser({
            id: parsed.profile_id,
            email: parsed.email,
            role: parsed.role,
            name: parsed.name,
            status: "active",
            entity_id: parsed.entity_id,
          });
        } catch (e) {
          console.error("Failed to parse saved user", e);
        }
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email, password);
      const unifiedRole = (res.role === "faculty" || res.role === "teacher") ? "teacher" : res.role;
      setUser({
        id: res.profile_id,
        email: res.email,
        role: unifiedRole as any,
        name: res.name,
        status: "active",
        entity_id: res.entity_id,
      });

      if (unifiedRole === "teacher") {
        router.push("/teacher");
      } else if (unifiedRole === "student") {
        router.push("/student");
      } else if (unifiedRole === "admin") {
        router.push("/admin");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = async (role: "teacher" | "student" | "admin") => {
    const creds = {
      teacher: { email: "teacher@snapclass.edu", password: "Password123!" },
      student: { email: "student1@snapclass.edu", password: "Password123!" },
      admin: { email: "admin@snapclass.edu", password: "Password123!" },
    };
    await login(creds[role].email, creds[role].password);
  };

  const logout = (redirectTo: any = "/login") => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      const routeRole = path.startsWith("/teacher") ? "teacher" : path.startsWith("/student") ? "student" : path.startsWith("/admin") ? "admin" : null;
      if (routeRole) {
        localStorage.removeItem(`snapclass_token_${routeRole}`);
        localStorage.removeItem(`snapclass_user_${routeRole}`);
      }
      localStorage.removeItem("snapclass_token");
      localStorage.removeItem("snapclass_user");
      try {
        sessionStorage.removeItem("snapclass_student_cache");
      } catch {}
    }
    setUser(null);
    if (typeof redirectTo === "string") {
      router.push(redirectTo);
    } else if (redirectTo !== null && typeof redirectTo !== "object") {
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, quickLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

