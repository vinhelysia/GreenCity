import type { Metadata } from "next";
import { FeatureUnavailable } from "@/components/feature-unavailable";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Dịch vụ",
  description: "Tổng quan dịch vụ GreenCity — vỏ giao diện, chưa có thương mại.",
};

export default function DichVuPage() {
  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title="Dịch vụ"
        description={
          <p>
            GreenCity dự kiến giới thiệu các dịch vụ liên quan tái chế phế liệu
            và hỗ trợ dọn dẹp. Trang này là khung tổng quan — chưa mở đăng ký
            dịch vụ, báo giá hay thanh toán.
          </p>
        }
      />
      <FeatureUnavailable
        testId="dich-vu-unavailable"
        title="Danh mục dịch vụ chưa mở"
        description={
          <p>
            Không có gói dịch vụ giả, không có nút mua. Khi catalog và quy trình
            vận hành sẵn sàng, danh sách dịch vụ sẽ được gắn vào đây.
          </p>
        }
      />
    </div>
  );
}
