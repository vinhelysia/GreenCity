import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin-nav";

/**
 * Wraps every admin screen. The three queues had no links between them and
 * none in the public nav, so an admin could only move around by typing URLs.
 * Access itself is enforced by the API, not by this layout.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-6">
      <AdminNav />
      {children}
    </div>
  );
}
