import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-w-0 max-w-prose">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Không tìm thấy trang
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        Đường dẫn không tồn tại hoặc đã được di chuyển. Kiểm tra lại địa chỉ
        hoặc quay về trang chủ GreenCity.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md border border-edge bg-paper px-4 py-2 text-sm font-medium text-ink hover:border-accent hover:text-accent"
      >
        Về trang chủ
      </Link>
    </div>
  );
}
