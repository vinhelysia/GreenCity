import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminGrantPass } from "@/components/admin-grant-pass";
import { AdminListingQueue } from "@/components/admin-listing-queue";
import { PageHeader } from "@/components/page-header";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return {
    title: t("transactionsTab"),
    description: t("transactionQueueTitle"),
  };
}

export default async function AdminGiaoDichPage({
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
        title={t("transactionsTab")}
        description={<p>{t("transactionQueueTitle")}</p>}
      />
      <AdminGrantPass />
      <AdminListingQueue />
    </div>
  );
}
