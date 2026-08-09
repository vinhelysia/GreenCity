import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin-nav";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-6">
      <AdminNav />
      {children}
    </div>
  );
}
