import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminQuoteQueue } from "@/components/admin-quote-queue";
import { PageHeader } from "@/components/page-header";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return {
    title: t("quotesTab"),
    description: t("quoteQueueTitle"),
  };
}

export default async function AdminBaoGiaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "admin" });

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title={t("quotesTab")}
        description={<p>{t("quoteQueueTitle")}</p>}
      />
      <AdminQuoteQueue />
    </div>
  );
}
