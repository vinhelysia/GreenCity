export const DEFAULT_SITE_URL = "https://green-city-web.vercel.app";

/**
 * Returns an absolute site origin suitable for metadata. Deployment input may
 * contain a trailing slash or an accidental path, but metadata must never turn
 * that into a canonical URL for every page.
 */
export function getSiteUrl(
  configuredUrl = process.env.NEXT_PUBLIC_APP_URL,
): string {
  const value = configuredUrl?.trim();
  if (!value) return DEFAULT_SITE_URL;

  try {
    const url = new URL(value);
    const localHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (
      (url.protocol !== "https:" && !localHttp) ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return DEFAULT_SITE_URL;
    }

    return url.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function getHomePageUrl(locale: string): string {
  const siteUrl = getSiteUrl();
  return locale === "en" ? `${siteUrl}/en` : siteUrl;
}
