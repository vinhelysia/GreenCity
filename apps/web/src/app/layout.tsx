import type { Metadata } from "next";
import { Be_Vietnam_Pro, Bricolage_Grotesque } from "next/font/google";
import { APP_NAME } from "@greencity/shared";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SkipLink } from "@/components/skip-link";
import "./globals.css";

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

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s — ${APP_NAME}`,
  },
  description:
    "GreenCity — nền tảng tái chế phế liệu và đóng góp làm sạch thành phố. Giao diện công khai giai đoạn nền tảng.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${display.variable} ${body.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans text-ink antialiased">
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
      </body>
    </html>
  );
}
