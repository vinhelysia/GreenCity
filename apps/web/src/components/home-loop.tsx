/**
 * The five stages a kilo of scrap actually passes through. Numbered because the
 * sequence is real and ordered — a buyer cannot reserve before a price exists,
 * and points are never awarded before an admin confirms the handover.
 *
 * Deliberately not cards: the sections around this one are bordered cards, and
 * repeating that shell for every kind of content is what flattened the page.
 */
const STAGES = [
  {
    n: 1,
    title: "Người bán đăng phế liệu",
    body: "Chụp một ảnh, chọn loại, ước khối lượng. Không cần tự định giá, việc đó ở bước sau.",
  },
  {
    n: 2,
    title: "GreenCity báo giá",
    body: "Giá nằm trong khung công khai của từng loại phế liệu, nên người bán không bị ép giá.",
  },
  {
    n: 3,
    title: "Người mua đặt giữ",
    body: "Chỉ người mua đang có gói mới đặt giữ được. Người mua không nhìn thấy danh tính người bán.",
  },
  {
    n: 4,
    title: "Xác nhận giao hàng",
    body: "Giao xong, ban quản lý xác nhận hoàn tất. Trước bước này chưa có điểm nào được cộng.",
  },
  {
    n: 5,
    title: "Người bán nhận điểm",
    body: "Điểm vào sổ ngay khi giao dịch hoàn tất, luôn truy được về đúng giao dịch đã sinh ra nó.",
  },
] as const;

export function HomeLoop() {
  return (
    <ol className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
      {STAGES.map((stage) => (
        <li key={stage.n} className="min-w-0 border-t-2 border-accent pt-3">
          <p
            aria-hidden="true"
            className="font-display text-sm font-bold tabular-nums tracking-widest text-accent"
          >
            {String(stage.n).padStart(2, "0")}
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold tracking-tight text-ink">
            {stage.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{stage.body}</p>
        </li>
      ))}
    </ol>
  );
}
