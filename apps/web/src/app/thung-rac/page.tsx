import type { Metadata } from "next";
import { FeatureUnavailable } from "@/components/feature-unavailable";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Thùng rác",
  description:
    "Hướng dẫn phân loại và tra cứu thùng rác công cộng. Đang làm, chưa có bản đồ.",
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
            Chưa có dữ liệu thùng rác và chưa gắn bản đồ. Chúng tôi không dựng
            dữ liệu giả để lấp chỗ trống, nên mục này sẽ trống cho tới khi có
            nguồn dữ liệu địa điểm thật.
          </p>
        }
      />
    </div>
  );
}
