import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  locales: ["vi", "en"],
  defaultLocale: "vi",
  localePrefix: "as-needed",
  localeDetection: false,
  pathnames: {
    "/": "/",
    "/thung-rac": {
      vi: "/thung-rac",
      en: "/recycling-bins",
    },
    "/dich-vu": {
      vi: "/dich-vu",
      en: "/services",
    },
    "/ban-phe-lieu": {
      vi: "/ban-phe-lieu",
      en: "/sell-scrap",
    },
    "/dong-gop": {
      vi: "/dong-gop",
      en: "/community-cleanup",
    },
    "/cho-online": {
      vi: "/cho-online",
      en: "/marketplace",
    },
    "/diem-thuong": {
      vi: "/diem-thuong",
      en: "/rewards",
    },
    "/dang-nhap": {
      vi: "/dang-nhap",
      en: "/login",
    },
    "/dang-ky": {
      vi: "/dang-ky",
      en: "/register",
    },
    "/admin/bao-gia": {
      vi: "/admin/bao-gia",
      en: "/admin/quotes",
    },
    "/admin/dong-gop": {
      vi: "/admin/dong-gop",
      en: "/admin/cleanup",
    },
    "/admin/giao-dich": {
      vi: "/admin/giao-dich",
      en: "/admin/transactions",
    },
  },
});

export type Pathnames = keyof typeof routing.pathnames;
export type Locale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
