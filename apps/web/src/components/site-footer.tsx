import Link from "next/link";
import { APP_NAME } from "@greencity/shared";
import { EcoBadge } from "./eco-badge";
import { IconLeaf, IconShieldCheck } from "./eco-icons";
import { NAV_LINKS } from "./nav-links";

/** Modern civic eco footer — identity, tagline, navigation, transparency badge. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-edge bg-card text-ink">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-12 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 max-w-md">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-eco-sm">
              <IconLeaf className="h-4.5 w-4.5" />
            </span>
            <span className="font-display text-xl font-bold tracking-tight text-ink">
              {APP_NAME}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Nền tảng kết nối bán phế liệu tái chế theo khung giá niêm yết và báo cáo điểm rác
            tự phát để ban quản lý xác minh, ghi nhận điểm thưởng sinh thái.
          </p>
          <div className="mt-4 inline-flex items-center gap-2">
            <EcoBadge variant="mint" icon={<IconShieldCheck className="h-3.5 w-3.5" />}>
              Dữ liệu công khai & minh bạch
            </EcoBadge>
          </div>
        </div>

        <nav aria-label="Liên kết chân trang" className="min-w-0">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-ink">
            Điều hướng
          </h3>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-muted transition-colors hover:text-primary hover:underline"
                >
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/dang-ky"
                className="inline-flex min-h-11 items-center text-sm font-medium text-muted transition-colors hover:text-primary hover:underline"
              >
                Đăng ký
              </Link>
            </li>
            <li>
              <Link
                href="/dang-nhap"
                className="inline-flex min-h-11 items-center text-sm font-medium text-muted transition-colors hover:text-primary hover:underline"
              >
                Đăng nhập
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-edge bg-mint-surface/30 px-4 py-4 text-center text-xs text-muted">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} GreenCity. Nền tảng sinh thái đô thị Việt Nam.</p>
          <p>Dữ liệu vận hành & điểm thưởng theo thời gian thực.</p>
        </div>
      </div>
    </footer>
  );
}
