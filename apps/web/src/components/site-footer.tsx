import Link from "next/link";
import { APP_NAME } from "@greencity/shared";
import { IconLeaf, IconShieldCheck } from "./eco-icons";
import { NAV_LINKS } from "./nav-links";

/** Modern eco civic footer — identity, tagline, primary links. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-edge bg-card text-ink">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-12 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 max-w-md space-y-3">
          <div className="inline-flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-eco-sm">
              <IconLeaf className="h-4 w-4" />
            </span>
            <p className="font-display text-lg font-bold tracking-tight text-ink">
              {APP_NAME}
            </p>
          </div>
          <p className="text-sm leading-relaxed text-muted">
            Nền tảng thương mại tái chế cộng đồng. Nơi kết nối người bán phế
            liệu theo giá niêm yết công khai và ghi nhận các báo cáo điểm rác
            tự phát để cùng xây dựng đô thị xanh.
          </p>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-mint-surface px-3 py-1 text-xs font-medium text-primary">
            <IconShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>Dữ liệu công khai &amp; minh bạch</span>
          </div>
        </div>

        <nav aria-label="Liên kết chân trang" className="min-w-0">
          <p className="font-display text-xs font-bold uppercase tracking-wider text-muted mb-3">
            Điều hướng
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 max-w-md">
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-flex min-h-10 items-center text-sm font-medium text-muted transition-colors hover:text-primary hover:underline underline-offset-4"
                >
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/dang-ky"
                className="inline-flex min-h-10 items-center text-sm font-medium text-muted transition-colors hover:text-primary hover:underline underline-offset-4"
              >
                Đăng ký
              </Link>
            </li>
            <li>
              <Link
                href="/dang-nhap"
                className="inline-flex min-h-10 items-center text-sm font-medium text-muted transition-colors hover:text-primary hover:underline underline-offset-4"
              >
                Đăng nhập
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-edge/60 bg-paper py-4 text-center text-xs text-muted">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} {APP_NAME}. Vì môi trường đô thị bền vững.</span>
          <span className="text-primary font-medium">Bảo vệ môi trường · Tái chế giá trị</span>
        </div>
      </div>
    </footer>
  );
}
