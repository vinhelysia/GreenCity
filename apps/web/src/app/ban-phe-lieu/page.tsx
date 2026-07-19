import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SellScrapView } from "@/components/sell-scrap-view";

export const metadata: Metadata = {
  title: "Bán phế liệu",
  description:
    "Bảng giá phế liệu công khai và gửi yêu cầu bán phế liệu cho GreenCity báo giá.",
};

export default function BanPheLieuPage() {
  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title="Bán phế liệu"
        description={
          <p>
            Xem bảng giá thu mua theo từng loại phế liệu trước khi gửi yêu
            cầu. Gửi yêu cầu và theo dõi báo giá cần đăng nhập.
          </p>
        }
      />
      <SellScrapView />
    </div>
  );
}
