import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FeatureUnavailable } from "@/components/feature-unavailable";
import { PageHeader } from "@/components/page-header";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recyclingBins" });
  return {
    title: t("title"),
    description: t("lede"),
  };
}

export default async function ThungRacPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "recyclingBins" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const isEn = locale === "en";

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title={t("title")}
        description={<p>{t("lede")}</p>}
      />
      <FeatureUnavailable
        status={tCommon("inDevelopment")}
        testId="thung-rac-unavailable"
        title={isEn ? "Feature in Development" : "Tính năng đang phát triển"}
        description={
          <p>
            {isEn
              ? "Public recycling bin data and mapping integrations are currently under development."
              : "Chưa có dữ liệu thùng rác và chưa gắn bản đồ. Chúng tôi không dựng dữ liệu giả để lấp chỗ trống, nên mục này sẽ trống cho tới khi có nguồn dữ liệu địa điểm thật."}
          </p>
        }
      />
    </div>
  );
}
