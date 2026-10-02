"use client";

import { Suspense, type ComponentProps } from "react";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/routing";
import { getAuthReturnPath } from "@/lib/auth-return";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: "/dang-nhap" | "/dang-ky";
};

function AuthEntryLinkWithQuery({ href, ...props }: Props) {
  const pathname = usePathname();
  const search = useSearchParams();
  const next = getAuthReturnPath(
    pathname === "/dang-nhap" || pathname === "/dang-ky"
      ? search.get("next")
      : pathname,
  );
  return <Link {...props} href={{ pathname: href, query: { next } }} />;
}

/** Preserve the intended action across all login/register entry points. */
export function AuthEntryLink(props: Props) {
  const next = getAuthReturnPath(usePathname());
  return (
    <Suspense fallback={<Link {...props} href={{ pathname: props.href, query: { next } }} />}>
      <AuthEntryLinkWithQuery {...props} />
    </Suspense>
  );
}
