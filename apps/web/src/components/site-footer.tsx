import Link from "next/link";
import { APP_NAME } from "@greencity/shared";
import { NAV_LINKS } from "./nav-links";

/** Compact civic footer — identity, tagline, primary links. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-rule bg-paper-2">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 max-w-sm">
          <p className="font-display text-base font-semibold text-ink">{APP_NAME}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Nơi bán phế liệu tái chế theo giá niêm yết và báo điểm rác tự phát
            để được xác minh dọn dẹp.
          </p>
        </div>
        <nav aria-label="Liên kết chân trang">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/dang-ky"
                className="inline-flex min-h-11 items-center text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
              >
                Đăng ký
              </Link>
            </li>
            <li>
              <Link
                href="/dang-nhap"
                className="inline-flex min-h-11 items-center text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
              >
                Đăng nhập
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
