import type { Metadata } from "next";
import { Be_Vietnam_Pro, Bricolage_Grotesque } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { APP_NAME } from "@greencity/shared";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SkipLink } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import "../globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});

const body = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!routing.locales.includes(locale as any)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: "metadata" });

  const title = t("title");
  const description = t("description");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://greencity.app";
  const isEn = locale === "en";

  return {
    title: {
      default: APP_NAME,
      template: `%s · ${APP_NAME}`,
    },
    description,
    alternates: {
      canonical: isEn ? `${baseUrl}/en` : baseUrl,
      languages: {
        "vi-VN": baseUrl,
        "en-US": `${baseUrl}/en`,
      },
    },
    openGraph: {
      title,
      description,
      siteName: APP_NAME,
      locale: isEn ? "en_US" : "vi_VN",
      type: "website",
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${display.variable} ${body.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans text-ink antialiased">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <Providers>
            <SkipLink />
            <SiteHeader />
            <main
              id="noi-dung"
              className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10"
              tabIndex={-1}
            >
              {children}
            </main>
            <SiteFooter />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
