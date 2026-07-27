import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EcoBadge } from "@/components/eco-badge";
import { IconLeaf, IconShieldCheck, IconSparkles } from "@/components/eco-icons";
import { LoginForm } from "@/components/login-form";
import { PageHeader } from "@/components/page-header";
import { Link } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return {
    title: t("loginTitle"),
    description: t("loginDesc"),
  };
}

export default async function DangNhapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <div className="min-w-0">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <PageHeader
            eyebrow={locale === "en" ? "Member Account" : "Tài khoản thành viên"}
            title={t("loginTitle")}
            description={
              <p>
                {t("loginDesc")}{" "}
                <Link
                  href="/dang-ky"
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                >
                  {t("registerNow")}
                </Link>
                .
              </p>
            }
          />
          <div className="mt-6 rounded-2xl border border-edge bg-card p-6 shadow-eco sm:p-8">
            <LoginForm />
          </div>
        </div>

        <div className="lg:col-span-5 lg:pt-8">
          <div className="rounded-2xl border border-edge bg-mint-surface/40 p-6 shadow-eco-sm sm:p-8">
            <EcoBadge variant="primary" icon={<IconLeaf className="h-3.5 w-3.5" />}>
              {locale === "en" ? "GreenCity Member Benefits" : "Quyền lợi thành viên GreenCity"}
            </EcoBadge>
            <h2 className="mt-4 font-display text-xl font-bold text-ink">
              {locale === "en" ? "Join the Civilized Recycling Network" : "Tham gia mạng lưới tái chế văn minh"}
            </h2>
            <ul className="mt-5 space-y-4 text-sm leading-relaxed text-muted">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <IconShieldCheck className="h-4 w-4" />
                </span>
                <span>
                  <strong className="font-semibold text-ink">{locale === "en" ? "Published Scrap Prices:" : "Giá phế liệu chuẩn:"}</strong> {locale === "en" ? "Transparent rate bands protecting seller rights." : "Niêm yết công khai, bảo vệ quyền lợi người bán."}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <IconSparkles className="h-4 w-4" />
                </span>
                <span>
                  <strong className="font-semibold text-ink">{locale === "en" ? "Recyclables Marketplace:" : "Chợ vật liệu tái chế:"}</strong> {locale === "en" ? "Exclusive lot reservations for Pass holders." : "Dành riêng cho người mua có đăng ký gói quyền lợi."}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <IconLeaf className="h-4 w-4" />
                </span>
                <span>
                  <strong className="font-semibold text-ink">{locale === "en" ? "Community Action:" : "Đóng góp cộng đồng:"}</strong> {locale === "en" ? "Report dumping sites to earn reward points." : "Báo điểm rác nhận điểm thưởng và ghi nhận thành tích xanh."}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
