import type { Metadata } from "next";
import { CleanupReportView } from "@/components/cleanup-report-view";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Đóng góp",
  description: "Báo cáo điểm rác thải tự phát và theo dõi trạng thái.",
};

export default function DongGopPage() {
  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title="Đóng góp"
        description={
          <p>
            Báo cáo điểm rác thải tự phát để ban quản lý xác minh và tiến hành
            dọn dẹp.
          </p>
        }
      />
      <CleanupReportView />
    </div>
  );
}
