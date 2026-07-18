import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { FeatureUnavailable } from "@/components/feature-unavailable";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Chợ online",
  description:
    "Giới thiệu chợ phế liệu tái chế — chưa có tin đăng, đặt chỗ hay thanh toán.",
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
            tĩnh này.
          </p>
        }
      />

      <FeatureUnavailable
        testId="cho-online-unavailable"
        title="Chợ chưa mở giao dịch"
        description={
          <p>
            Chưa có danh sách tin đăng, đặt chỗ, gói đăng ký, thanh toán hay
            số dư thưởng. Các tính năng thương mại sẽ xuất hiện khi Phase
            marketplace và auth sẵn sàng.
          </p>
        }
      />

      <EmptyState
        testId="cho-online-listings-empty"
        title="Chưa có tin đăng"
        description="Khung danh sách trống — không hiển thị sản phẩm hay giá giả."
      />
    </div>
  );
}
