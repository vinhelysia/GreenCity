import type { Metadata } from "next";
import { FeatureUnavailable } from "@/components/feature-unavailable";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Thùng rác",
  description:
    "Khu vực hướng dẫn và tra cứu thùng rác — đang phát triển, chưa có bản đồ hay API.",
};

export default function ThungRacPage() {
  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title="Thùng rác"
        description={
          <p>
            Khu vực này sẽ hỗ trợ tra cứu và hướng dẫn phân loại rác, vị trí
            thùng rác công cộng khi dữ liệu và bản đồ được kết nối. Hiện tại
            chưa có lớp bản đồ hay API vị trí.
          </p>
        }
      />
      <FeatureUnavailable
        testId="thung-rac-unavailable"
        title="Tính năng đang phát triển"
        description={
          <p>
            Chưa có dữ liệu thùng rác, chưa tích hợp bản đồ, và không gọi API giả.
            Nội dung thật sẽ xuất hiện sau khi hợp đồng backend và nguồn dữ liệu
            địa điểm được chốt.
          </p>
        }
      />
    </div>
  );
}
