import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { AdminListingQueue } from "@/components/admin-listing-queue";

export const metadata: Metadata = {
  title: "Xác nhận giao dịch",
  description: "Hàng chờ xác nhận giao dịch đã đặt giữ cho quản trị viên.",
};

export default function AdminGiaoDichPage() {
  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title="Xác nhận giao dịch"
        description={
          <p>
            Xác nhận các giao dịch đã được người mua đặt giữ. Hoàn tất giao dịch
            sẽ cộng điểm thưởng cho người bán.
          </p>
        }
      />
      <AdminListingQueue />
    </div>
  );
}
