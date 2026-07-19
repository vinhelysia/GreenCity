"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { PublicUser } from "@greencity/shared";
import {
  fetchMe,
  postLogin,
  postLogout,
  postRegister,
  type ParsedApiError,
} from "@/lib/api";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: PublicUser | null;
  status: AuthStatus;
  login: (
    input: { email: string; password: string },
  ) => Promise<{ ok: true } | { ok: false; error: ParsedApiError; status: number }>;
  register: (
    input: {
      email: string;
      password: string;
      displayName?: string;
      phone?: string;
    },
  ) => Promise<{ ok: true } | { ok: false; error: ParsedApiError; status: number }>;
  logout: () => Promise<void>;
  /** Clear client auth and send user to login (session expired / 401). */
  clearSessionAndRedirect: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_PAGES = new Set(["/dang-nhap", "/dang-ky"]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const router = useRouter();
  const pathname = usePathname();

  const clearSessionAndRedirect = useCallback(() => {
    setUser(null);
    setStatus("unauthenticated");
    if (!AUTH_PAGES.has(pathname)) {
      router.replace("/dang-nhap");
    }
  }, [pathname, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchMe();
      if (cancelled) return;
      if (result.ok) {
        setUser(result.data.user);
        setStatus("authenticated");
        return;
      }
      // 401 = no session: signed out, do not flash authenticated UI.
      setUser(null);
      setStatus("unauthenticated");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const result = await postLogin(input);
      if (!result.ok) {
        return { ok: false as const, error: result.error, status: result.status };
      }
      setUser(result.data.user);
      setStatus("authenticated");
      return { ok: true as const };
    },
    [],
  );

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      displayName?: string;
      phone?: string;
    }) => {
      const result = await postRegister(input);
      if (!result.ok) {
        return { ok: false as const, error: result.error, status: result.status };
      }
      setUser(result.data.user);
      setStatus("authenticated");
      return { ok: true as const };
    },
    [],
  );

  const logout = useCallback(async () => {
    const result = await postLogout();
    setUser(null);
    setStatus("unauthenticated");
    if (!result.ok && result.status === 401) {
      // Already signed out server-side; stay consistent client-side.
      return;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      login,
      register,
      logout,
      clearSessionAndRedirect,
    }),
    [user, status, login, register, logout, clearSessionAndRedirect],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
