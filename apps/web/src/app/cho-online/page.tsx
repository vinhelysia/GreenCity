import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { MarketplaceListings } from "@/components/marketplace-listings";

export const metadata: Metadata = {
  title: "Chợ online",
  description:
    "Tin đăng phế liệu tái chế đang niêm yết giá cố định — người mua đã đăng ký gói có thể đặt giữ.",
};

export default function ChoOnlinePage() {
  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title="Chợ online"
        description={
          <p>
            Chợ online là nơi người bán gửi phế liệu tái chế, GreenCity báo giá,
            tin đăng niêm yết giá cố định, và người mua đã đăng ký gói có thể
            đặt chỗ. Thanh toán và thưởng người bán diễn ra sau khi khối lượng
            được xác nhận — theo quy trình backend, không phải trên giao diện
            này.
          </p>
        }
      />

      <MarketplaceListings />
    </div>
  );
}
