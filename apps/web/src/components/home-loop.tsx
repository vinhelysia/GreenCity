import { EcoBadge } from "@/components/eco-badge";

/**
 * The five stages a kilo of scrap passes through.
 * Visual sequence cards showing transparency & integrity.
 */
const STAGES = [
  {
    n: 1,
    title: "Người bán đăng phế liệu",
    body: "Chụp ảnh, chọn loại phế liệu & ước tính khối lượng. Không cần tự định giá.",
    badge: "Bước 01",
  },
  {
    n: 2,
    title: "GreenCity báo giá",
    body: "Báo giá theo khung công khai của từng loại phế liệu, đảm bảo không bị ép giá.",
    badge: "Bước 02",
  },
  {
    n: 3,
    title: "Người mua đặt giữ",
    body: "Người mua có gói đăng ký tiến hành đặt giữ đơn hàng công khai.",
    badge: "Bước 03",
  },
  {
    n: 4,
    title: "Xác nhận giao hàng",
    body: "Hai bên hoàn tất giao hàng và ban quản lý xác nhận thành công.",
    badge: "Bước 04",
  },
  {
    n: 5,
    title: "Tích lũy điểm thưởng",
    body: "Điểm được ghi tự động vào sổ điểm của người bán (1 điểm / 1.000 VNĐ).",
    badge: "Hoàn tất",
  },
] as const;

export function HomeLoop() {
  return (
    <ol className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {STAGES.map((stage) => (
        <li
          key={stage.n}
          className="group relative flex min-w-0 flex-col justify-between rounded-xl border border-edge bg-card p-5 shadow-eco-sm transition duration-quick hover:border-primary/40 hover:shadow-eco hover:-translate-y-0.5"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-display text-xs font-bold tabular-nums shadow-eco-sm">
                {String(stage.n).padStart(2, "0")}
              </span>
              <EcoBadge
                variant={stage.n === 5 ? "coral" : "mint"}
                className="text-[10px]"
              >
                {stage.badge}
              </EcoBadge>
            </div>
            <h3 className="font-display text-base font-bold tracking-tight text-ink">
              {stage.title}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {stage.body}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
