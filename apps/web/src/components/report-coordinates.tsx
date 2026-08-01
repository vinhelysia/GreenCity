"use client";

import { useTranslations } from "next-intl";

/**
 * The pinned location of a dumping site, with a link that opens it on a map.
 *
 * Renders nothing when a report has no coordinates. Every report submitted
 * before the map picker existed is in that state, and so is any report from
 * someone who denied location access and typed an address instead — neither is
 * an error worth showing an empty row for.
 *
 * OpenStreetMap rather than Google Maps: the project deliberately has no Google
 * dependency, and this link has to work for an admin who never signs in
 * anywhere.
 */
export function ReportCoordinates({
  latitude,
  longitude,
}: {
  latitude: number | null;
  longitude: number | null;
}) {
  const t = useTranslations("cleanup");

  if (latitude === null || longitude === null) return null;

  // mlat/mlon drops the marker; the hash sets the view, and OSM needs both.
  const href = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`;

  return (
    <p className="mt-1 text-sm text-muted">
      <span className="tabular-nums">
        {t("coordsLabel")}: {latitude.toFixed(5)}, {longitude.toFixed(5)}
      </span>{" "}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-warm-600 underline-offset-4 hover:underline"
      >
        {t("openInMap")}
      </a>
    </p>
  );
}
