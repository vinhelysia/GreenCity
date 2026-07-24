import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { MarketplaceListings } from "@/components/marketplace-listings";

export const metadata: Metadata = {
  title: "Chợ online",
  description:
    "Phế liệu tái chế đang bán theo giá niêm yết. Người mua có gói thì đặt giữ được.",
};

export default function ChoOnlinePage() {
  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title="Chợ online"
        description={
          <p>
            Người bán gửi phế liệu, GreenCity báo giá theo khung công khai của
            từng loại, rồi người mua có gói đặt giữ. Điểm thưởng cho người bán
            chỉ được cộng sau khi ban quản lý xác nhận đã giao hàng xong.
          </p>
        }
      />

      <MarketplaceListings />
    </div>
  );
}
