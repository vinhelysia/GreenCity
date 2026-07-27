import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminCleanupQueue } from "@/components/admin-cleanup-queue";
import { PageHeader } from "@/components/page-header";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return {
    title: t("cleanupTab"),
    description: t("cleanupQueueTitle"),
  };
}

export default async function AdminDongGopPage({
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
        title={t("cleanupTab")}
        description={<p>{t("cleanupQueueTitle")}</p>}
      />
      <AdminCleanupQueue />
    </div>
  );
}
