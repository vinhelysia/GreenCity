import type { Metadata } from "next";
import { APP_NAME } from "@greencity/shared";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "GreenCity Phase 0 shell — marketplace features come later.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
