import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketplaceListings } from "@/components/marketplace-listings";
import { PageHeader } from "@/components/page-header";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketplace" });
  return {
    title: t("title"),
    description: t("lede"),
  };
}

export default async function ChoOnlinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "marketplace" });

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title={t("title")}
        description={<p>{t("lede")}</p>}
      />

      <MarketplaceListings />
    </div>
  );
}
