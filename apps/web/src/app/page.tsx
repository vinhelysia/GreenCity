import Link from "next/link";
import { EcoBadge } from "@/components/eco-badge";
import { IconArrowRight, IconDumpster, IconLeaf, IconPackage, IconSparkles } from "@/components/eco-icons";
import { HomeHero } from "@/components/home-hero";
import { HomeHighlights } from "@/components/home-highlights";
import { HomeLoop } from "@/components/home-loop";
import { Section } from "@/components/section";

/**
 * Public homepage — Modern Eco Marketplace design.
 * Clear value proposition, core user journeys, live statistics,
 * transparent 5-step recycling loop, and documented point rules.
 */
export default function HomePage() {
  return (
    <div className="min-w-0 space-y-12 sm:space-y-16">
      <HomeHero />

      {/* Core User Journey Cards */}
      <section aria-label="Hành trình cốt lõi" className="min-w-0">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="flex min-w-0 flex-col justify-between rounded-2xl border border-edge bg-card p-6 shadow-eco transition-shadow hover:border-primary/40 hover:shadow-eco-hover">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-mint-surface text-primary shadow-eco-sm">
                <IconPackage className="h-6 w-6" />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-ink">Bán phế liệu</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Đăng phế liệu tái chế dễ dàng. Nhận báo giá minh bạch theo khung giá chuẩn thị trường.
              </p>
            </div>
            <Link
              href="/ban-phe-lieu"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover hover:underline"
            >
              <span>Xem khung giá & đăng bán</span>
              <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex min-w-0 flex-col justify-between rounded-2xl border border-edge bg-card p-6 shadow-eco transition-shadow hover:border-primary/40 hover:shadow-eco-hover">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-mint-surface text-primary shadow-eco-sm">
                <IconSparkles className="h-6 w-6" />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-ink">Mua vật liệu tái chế</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Dành cho các cơ sở và cá nhân mua gom. Đặt giữ nguồn nguyên liệu công khai, minh bạch.
              </p>
            </div>
            <Link
              href="/cho-online"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover hover:underline"
            >
              <span>Khám phá chợ online</span>
              <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex min-w-0 flex-col justify-between rounded-2xl border border-edge bg-card p-6 shadow-eco transition-shadow hover:border-primary/40 hover:shadow-eco-hover">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-mint-surface text-primary shadow-eco-sm">
                <IconDumpster className="h-6 w-6" />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-ink">Báo điểm rác tồn đọng</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Chụp ảnh & báo cáo điểm rác ô nhiễm tự phát. Ban quản lý xác minh trước khi cộng điểm thưởng.
              </p>
            </div>
            <Link
              href="/dong-gop"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover hover:underline"
            >
              <span>Báo điểm rác ngay</span>
              <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

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
            <div className="min-w-0 rounded-2xl border border-edge bg-card p-6 shadow-eco">
              <dt className="font-display text-2xl font-bold tabular-nums tracking-tight text-primary sm:text-3xl">
                1 điểm / 1.000&nbsp;₫
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">
                Tính trên số tiền người bán thực nhận, tối thiểu 1 điểm mỗi giao dịch hoàn tất.
              </dd>
            </div>
            <div className="min-w-0 rounded-2xl border border-edge bg-card p-6 shadow-eco">
              <dt className="font-display text-2xl font-bold tabular-nums tracking-tight text-primary sm:text-3xl">
                50 điểm
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">
                Cho mỗi báo cáo điểm rác được ban quản lý xác minh là có thật.
              </dd>
            </div>
          </dl>

          <div className="min-w-0 rounded-2xl border border-edge bg-card p-6 shadow-eco text-sm leading-relaxed text-muted flex flex-col justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-ink mb-3">Quy tắc điểm thưởng minh bạch</h3>
              <p>
                Điểm thưởng không phải tiền và không mua bán được. Sổ điểm{" "}
                <strong className="font-semibold text-ink">chỉ ghi thêm</strong>: không có ô số dư
                nào để sửa, nên mỗi điểm luôn truy ngược được về đúng việc đã sinh ra nó. Một việc
                cũng chỉ được cộng đúng một lần.
              </p>
              <p className="mt-3">
                Hướng quy đổi điểm sang dịch vụ công cộng của thành phố mới ở giai đoạn đề xuất. Hệ
                thống này chưa mở việc đổi điểm.
              </p>
            </div>
            <Link
              href="/diem-thuong"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover hover:underline"
            >
              <span>Xem điểm thưởng của tôi</span>
              <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Section>

      {/* Final Eco Callout Banner */}
      <section aria-label="Kêu gọi hành động" className="rounded-3xl bg-primary p-8 text-white shadow-eco sm:p-12">
        <div className="mx-auto max-w-3xl text-center">
          <EcoBadge variant="mint" className="bg-white/10 text-white border-white/20">
            Cùng xây dựng đô thị xanh
          </EcoBadge>
          <h2 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">
            Bắt đầu phân loại phế liệu & giữ gìn môi trường ngay hôm nay
          </h2>
          <p className="mt-4 text-base text-primary-soft sm:text-lg">
            Mỗi hành động nhỏ đều đóng góp vào mục tiêu tái chế tài nguyên & giảm thiểu rác thải tự phát.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/ban-phe-lieu"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-primary shadow-eco-sm transition-colors hover:bg-mint-surface"
            >
              <span>Bán phế liệu ngay</span>
            </Link>
            <Link
              href="/dong-gop"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/30 bg-transparent px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-white/10"
            >
              <span>Báo điểm rác</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
