import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { SellScrapView } from "@/components/sell-scrap-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sellScrap" });
  return {
    title: t("title"),
    description: t("lede"),
  };
}

export default async function BanPheLieuPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "sellScrap" });

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title={t("title")}
        description={<p>{t("lede")}</p>}
      />
      <SellScrapView />
    </div>
  );
}
