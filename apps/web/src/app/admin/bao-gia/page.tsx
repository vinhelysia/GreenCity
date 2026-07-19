import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { AdminQuoteQueue } from "@/components/admin-quote-queue";

export const metadata: Metadata = {
  title: "Báo giá phế liệu",
  description: "Hàng chờ báo giá cho quản trị viên.",
};

export default function AdminBaoGiaPage() {
  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title="Báo giá phế liệu"
        description={<p>Duyệt yêu cầu bán phế liệu đang chờ báo giá.</p>}
      />
      <AdminQuoteQueue />
    </div>
  );
}
