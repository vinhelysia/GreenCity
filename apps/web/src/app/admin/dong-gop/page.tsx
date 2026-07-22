import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { AdminCleanupQueue } from "@/components/admin-cleanup-queue";

export const metadata: Metadata = {
  title: "Duyệt báo cáo điểm rác",
  description: "Hàng chờ duyệt báo cáo điểm rác cho quản trị viên.",
};

export default function AdminDongGopPage() {
  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title="Duyệt báo cáo điểm rác"
        description={<p>Duyệt các báo cáo điểm rác thải tự phát đang chờ xác minh.</p>}
      />
      <AdminCleanupQueue />
    </div>
  );
}
