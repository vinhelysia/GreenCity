"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth-provider";

/** Client providers tree for the App Router layout. */
export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
