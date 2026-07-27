import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <div className="min-w-0 max-w-prose">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        {t("title")}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        {t("desc")}
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md border border-edge bg-paper px-4 py-2 text-sm font-medium text-ink hover:border-primary hover:text-primary"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
