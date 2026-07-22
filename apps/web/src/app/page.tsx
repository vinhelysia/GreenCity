import { APP_NAME } from "@greencity/shared";
import { EmptyState } from "@/components/empty-state";
import { HomeHighlights } from "@/components/home-highlights";
import { Section } from "@/components/section";

/**
 * Public homepage — teacher-approved section order:
 * Quảng cáo → Tin tức → Thế giới → Dự án
 * All content slots are honest editorial placeholders.
 */
export default function HomePage() {
  return (
    <div className="min-w-0 space-y-2 sm:space-y-4">
      <header className="min-w-0 pb-6 sm:pb-8">
        <p className="text-sm font-medium tracking-wide text-accent">
          Nền tảng môi trường đô thị
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl md:text-[2.5rem] md:leading-tight">
          GreenCity — tái chế và làm sạch thành phố
        </h1>
        <p className="mt-4 max-w-prose text-base leading-relaxed text-muted sm:text-lg">
          {APP_NAME} kết nối hai mảng:{" "}
          <strong className="font-medium text-ink">chợ phế liệu tái chế</strong>{" "}
          và{" "}
          <strong className="font-medium text-ink">
            đóng góp dọn dẹp điểm rác
          </strong>
          . Chợ phế liệu và hệ thống báo cáo dọn dẹp điểm rác hiện đã đi vào
          hoạt động.
        </p>
      </header>

      <HomeHighlights />

      <Section id="quang-cao" title="Quảng cáo">
        <div
          data-testid="ad-slot"
          className="placeholder-slot"
          role="region"
          aria-label="Vị trí quảng cáo (chưa có nội dung)"
        >
          <p className="font-medium text-ink">Vị trí quảng cáo</p>
          <p className="mt-1 text-sm leading-relaxed">
            Placeholder biên tập — chưa có quảng cáo thật. Không hiển thị dữ liệu
            giả.
          </p>
        </div>
      </Section>

      <Section id="tin-tuc" title="Tin tức">
        <EmptyState
          testId="news-empty"
          title="Chưa có tin tức"
          description="Kênh tin nội bộ và thông báo cộng đồng sẽ xuất hiện tại đây khi hệ thống biên tập được kết nối. Đây không phải danh sách tin giả."
        />
      </Section>

      <Section id="the-gioi" title="Thế giới">
        <EmptyState
          testId="world-empty"
          title="Chưa có tin thế giới"
          description="Mục tin môi trường quốc tế / khu vực — placeholder. Nội dung sẽ được biên tập viên cập nhật sau."
        />
      </Section>

      <Section id="du-an" title="Dự án">
        <EmptyState
          testId="projects-empty"
          title="Chưa có dự án"
          description="Các dự án tái chế và làm sạch sẽ được giới thiệu khi có dữ liệu thật từ vận hành GreenCity."
        />
      </Section>
    </div>
  );
}
