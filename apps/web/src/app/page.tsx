import Link from "next/link";
import { EcoBadge } from "@/components/eco-badge";
import { IconArrowRight, IconDumpster, IconPackage, IconRecycle } from "@/components/eco-icons";
import { HomeHero } from "@/components/home-hero";
import { HomeHighlights } from "@/components/home-highlights";
import { HomeLoop } from "@/components/home-loop";
import { Section } from "@/components/section";

export default function HomePage() {
  return (
    <div className="min-w-0 space-y-14 sm:space-y-20">
      <HomeHero />

      {/* Core User Journey Cards */}
      <section aria-label="Hành trình trải nghiệm" className="min-w-0">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="group relative flex flex-col justify-between rounded-2xl border border-edge bg-card p-6 shadow-eco-sm transition duration-300 hover:border-primary/40 hover:shadow-eco hover:-translate-y-1">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-mint-surface text-primary shadow-eco-sm group-hover:bg-primary group-hover:text-white transition-colors">
                  <IconRecycle className="h-6 w-6" />
                </span>
                <EcoBadge variant="mint" className="text-xs">Dành cho Người bán</EcoBadge>
              </div>
              <h3 className="font-display text-xl font-bold text-ink">Bán phế liệu</h3>
              <p className="text-sm leading-relaxed text-muted">
                Bảng giá thu mua phế liệu niêm yết công khai. Gửi yêu cầu và nhận báo giá minh bạch từ GreenCity.
              </p>
            </div>
            <div className="mt-6 border-t border-edge/60 pt-4">
              <Link
                href="/ban-phe-lieu"
                className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline underline-offset-4"
              >
                <span>Xem bảng giá &amp; Bán ngay</span>
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="group relative flex flex-col justify-between rounded-2xl border border-edge bg-card p-6 shadow-eco-sm transition duration-300 hover:border-primary/40 hover:shadow-eco hover:-translate-y-1">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-mint-surface text-primary shadow-eco-sm group-hover:bg-primary group-hover:text-white transition-colors">
                  <IconPackage className="h-6 w-6" />
                </span>
                <EcoBadge variant="yellow" className="text-xs">Dành cho Người mua</EcoBadge>
              </div>
              <h3 className="font-display text-xl font-bold text-ink">Mua vật liệu tái chế</h3>
              <p className="text-sm leading-relaxed text-muted">
                Khám phá các lô phế liệu đã kiểm định trên Chợ online. Người mua có gói có thể đặt giữ trực tiếp.
              </p>
            </div>
            <div className="mt-6 border-t border-edge/60 pt-4">
              <Link
                href="/cho-online"
                className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline underline-offset-4"
              >
                <span>Khám phá Chợ online</span>
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="group relative flex flex-col justify-between rounded-2xl border border-edge bg-card p-6 shadow-eco-sm transition duration-300 hover:border-coral/40 hover:shadow-eco hover:-translate-y-1">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-coral/10 text-coral shadow-eco-sm group-hover:bg-coral group-hover:text-white transition-colors">
                  <IconDumpster className="h-6 w-6" />
                </span>
                <EcoBadge variant="coral" className="text-xs">Cộng đồng xanh</EcoBadge>
              </div>
              <h3 className="font-display text-xl font-bold text-ink">Đóng góp cộng đồng</h3>
              <p className="text-sm leading-relaxed text-muted">
                Gửi ảnh báo cáo các điểm rác tự phát để ban quản lý xác minh, giữ gìn vệ sinh và nhận điểm thưởng.
              </p>
            </div>
            <div className="mt-6 border-t border-edge/60 pt-4">
              <Link
                href="/dong-gop"
                className="inline-flex items-center gap-2 text-sm font-bold text-coral hover:underline underline-offset-4"
              >
                <span>Báo điểm rác tự phát</span>
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <HomeHighlights />

      <Section
        id="vong-lap"
        title="Một kilo phế liệu đi qua năm bước"
        tone="open"
        lede="Quy trình minh bạch, điểm thưởng chỉ xuất hiện sau khi giao dịch thật sự hoàn tất."
      >
        <HomeLoop />
      </Section>

      <Section
        id="cach-tinh-diem"
        title="Một điểm thưởng đáng giá bao nhiêu"
        tone="band"
      >
        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
          <dl className="min-w-0 space-y-6">
            <div className="min-w-0 rounded-xl border border-primary/20 bg-card p-5 shadow-eco-sm">
              <dt className="font-display text-2xl font-bold tabular-nums tracking-tight text-primary sm:text-3xl">
                1 điểm / 1.000&nbsp;₫
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">
                Tính trên số tiền người bán thực nhận, tối thiểu 1 điểm mỗi giao
                dịch hoàn tất.
              </dd>
            </div>
            <div className="min-w-0 rounded-xl border border-coral/20 bg-card p-5 shadow-eco-sm">
              <dt className="font-display text-2xl font-bold tabular-nums tracking-tight text-coral sm:text-3xl">
                50 điểm
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">
                Cho mỗi báo cáo điểm rác được ban quản lý xác minh là có thật.
              </dd>
            </div>
          </dl>

          <div className="min-w-0 max-w-prose space-y-4 rounded-xl border border-edge bg-card p-6 shadow-eco-sm text-sm leading-relaxed text-muted">
            <p>
              Điểm thưởng không phải tiền và không mua bán được. Sổ điểm{" "}
              <strong className="font-semibold text-ink">chỉ ghi thêm</strong>:
              không có ô số dư nào để sửa, nên mỗi điểm luôn truy ngược được về
              đúng việc đã sinh ra nó. Một việc cũng chỉ được cộng đúng một lần.
            </p>
            <p>
              Hướng quy đổi điểm sang dịch vụ công cộng của thành phố mới ở giai
              đoạn đề xuất. Hệ thống này chưa mở việc đổi điểm.
            </p>
            <div className="pt-2">
              <Link
                href="/diem-thuong"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover shadow-eco-sm"
              >
                <span>Xem sổ điểm thưởng của tôi</span>
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {/* Final Eco Call-to-Action Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary via-primary-hover to-ink p-8 text-white shadow-eco sm:p-12">
        <div className="relative z-10 max-w-2xl space-y-4">
          <EcoBadge variant="mint" className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
            Hành động hôm nay
          </EcoBadge>
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            Cùng xây dựng thành phố xanh, sạch và bền vững hơn
          </h2>
          <p className="text-base text-primary-soft leading-relaxed">
            Dù bạn là người bán phế liệu cá nhân, đại lý thu gom hay người mua chuyên nghiệp, GreenCity đồng hành tạo nên hệ sinh thái tái chế minh bạch.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-4">
            <Link
              href="/ban-phe-lieu"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-primary transition hover:bg-mint-surface shadow-eco"
            >
              <span>Bán phế liệu ngay</span>
              <IconArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/cho-online"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              <span>Khám phá Chợ online</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
