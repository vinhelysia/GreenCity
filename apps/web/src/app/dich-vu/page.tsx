import type { Metadata } from "next";
import { FeatureUnavailable } from "@/components/feature-unavailable";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Dịch vụ",
  description:
    "Tổng quan dịch vụ GreenCity. Phần này mới là khung giao diện, chưa mở đăng ký.",
};

export default function DichVuPage() {
  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title="Dịch vụ"
        description={
          <p>
            GreenCity dự kiến mở thêm các dịch vụ quanh việc tái chế phế liệu và
            hỗ trợ dọn dẹp. Trang này mới là khung tổng quan. Chưa đăng ký dịch
            vụ, chưa báo giá và chưa thanh toán được.
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
