import type { Metadata } from "next";
import { FeatureUnavailable } from "@/components/feature-unavailable";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Đóng góp",
  description:
    "Luồng đóng góp báo cáo điểm rác — thông tin giới thiệu, chưa gửi báo cáo.",
};

export default function DongGopPage() {
  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title="Đóng góp"
        description={
          <p>
            Luồng đóng góp giúp người dân báo cáo điểm rác thải tự phát. Sau
            khi quản trị xác minh, đối tác dọn dẹp thực hiện và bằng chứng được
            duyệt, người báo cáo có thể nhận thưởng theo sổ cái phần thưởng.
          </p>
        }
      />

      <ol className="max-w-prose list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted sm:text-base">
        <li>
          <span className="font-medium text-ink">Gửi báo cáo</span> — mô tả và
          ảnh (chưa mở form).
        </li>
        <li>
          <span className="font-medium text-ink">Xác minh</span> — GreenCity
          kiểm tra và loại trùng.
        </li>
        <li>
          <span className="font-medium text-ink">Dọn dẹp</span> — đối tác thực
          hiện và gửi bằng chứng.
        </li>
        <li>
          <span className="font-medium text-ink">Thưởng</span> — sau hoàn tất
          được xác minh (ledger, không số dư giả).
        </li>
      </ol>

      <FeatureUnavailable
        testId="dong-gop-unavailable"
        title="Chưa nhận báo cáo"
        description={
          <p>
            Form gửi báo cáo, tải ảnh và theo dõi trạng thái chưa được triển
            khai. Không có endpoint giả và không lưu báo cáo trên trình duyệt.
          </p>
        }
      />
    </div>
  );
}
