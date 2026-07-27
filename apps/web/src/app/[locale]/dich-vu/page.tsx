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
  const t = await getTranslations({ locale, namespace: "services" });
  return {
    title: t("title"),
    description: t("lede"),
  };
}

export default async function DichVuPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "services" });
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
        testId="dich-vu-unavailable"
        title={isEn ? "Service Catalog Unavailable" : "Danh mục dịch vụ chưa mở"}
        description={
          <p>
            {isEn
              ? "Additional GreenCity services are currently under development and will be available soon."
              : "Không có gói dịch vụ giả, không có nút mua. Khi catalog và quy trình vận hành sẵn sàng, danh sách dịch vụ sẽ được gắn vào đây."}
          </p>
        }
      />
    </div>
  );
}
