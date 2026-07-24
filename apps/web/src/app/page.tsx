import Link from "next/link";
import { HomeHero } from "@/components/home-hero";
import { HomeHighlights } from "@/components/home-highlights";
import { HomeLoop } from "@/components/home-loop";
import { Section } from "@/components/section";

/**
 * Public homepage. The four editorial placeholder slots that used to close this
 * page (advertising, news, world, projects) were empty by construction — four
 * "no content yet" boxes reading as an unfinished template. They are replaced
 * by the two things the product can genuinely explain: how the loop works, and
 * what a point is worth.
 */
export default function HomePage() {
  return (
    <div className="min-w-0">
      <HomeHero />
      <HomeHighlights />

      <Section
        id="vong-lap"
        title="Một kilo phế liệu đi qua năm bước"
        tone="open"
        lede="Điểm thưởng chỉ xuất hiện ở bước cuối, sau khi giao dịch thật sự hoàn tất."
        className="mt-12 sm:mt-16"
      >
        <HomeLoop />
      </Section>

      <Section
        id="cach-tinh-diem"
        title="Một điểm thưởng đáng giá bao nhiêu"
        tone="band"
        className="mt-14 sm:mt-20"
      >
        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
          <dl className="min-w-0 space-y-6">
            <div className="min-w-0">
              <dt className="font-display text-2xl font-bold tabular-nums tracking-tight text-accent sm:text-3xl">
                1 điểm / 1.000&nbsp;₫
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">
                Tính trên số tiền người bán thực nhận, tối thiểu 1 điểm mỗi giao
                dịch hoàn tất.
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="font-display text-2xl font-bold tabular-nums tracking-tight text-accent sm:text-3xl">
                50 điểm
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">
                Cho mỗi điểm rác được ban quản lý xác minh là đã dọn.
              </dd>
            </div>
          </dl>

          <div className="min-w-0 max-w-prose text-sm leading-relaxed text-muted">
            <p>
              Điểm thưởng không phải tiền và không mua bán được. Sổ điểm{" "}
              <strong className="font-medium text-ink">chỉ ghi thêm</strong>:
              không có ô số dư nào để sửa, nên mỗi điểm luôn truy ngược được về
              đúng việc đã sinh ra nó. Một việc cũng chỉ được cộng đúng một lần.
            </p>
            <p className="mt-3">
              Hướng quy đổi điểm sang dịch vụ công cộng của thành phố mới ở giai
              đoạn đề xuất. Hệ thống này chưa mở việc đổi điểm.
            </p>
            <Link
              href="/diem-thuong"
              className="mt-4 inline-flex items-center whitespace-nowrap text-sm font-medium text-accent underline-offset-4 hover:underline"
            >
              Xem điểm thưởng của tôi &rarr;
            </Link>
          </div>
        </div>
      </Section>
    </div>
  );
}
