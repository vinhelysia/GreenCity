import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { RecyclingPointsMap } from "@/components/recycling-points-map";
import { Section } from "@/components/section";
import {
  osmUrl,
  RECYCLING_CONTAINERS,
  RECYCLING_POINTS,
  RECYCLING_SNAPSHOT,
} from "@/data/recycling-points";
import { formatDate } from "@/lib/format";

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

/**
 * Vietnamese/English labels for the OSM `recycling:*` keys that actually occur
 * in the snapshot. An unknown key falls through to the raw OSM string rather
 * than being guessed at — a wrong translation of a material is worse than an
 * untranslated one, because the reader cannot tell it is wrong.
 */
const MATERIAL_LABELS: Record<string, { vi: string; en: string }> = {
  cans: { vi: "lon kim loại", en: "cans" },
  pet_drink_bottles: { vi: "chai nhựa PET", en: "PET drink bottles" },
  batteries: { vi: "pin", en: "batteries" },
  paper: { vi: "giấy", en: "paper" },
  glass_bottles: { vi: "chai thủy tinh", en: "glass bottles" },
  plastic: { vi: "nhựa", en: "plastic" },
};

function materialLabel(key: string, locale: string): string {
  const entry = MATERIAL_LABELS[key];
  if (!entry) return key;
  return locale === "en" ? entry.en : entry.vi;
}

export default async function ThungRacPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "recyclingBins" });

  const total = RECYCLING_POINTS.length;
  const containers = RECYCLING_CONTAINERS.length;

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader title={t("title")} description={<p>{t("lede")}</p>} />

      <section
        aria-labelledby="coverage-heading"
        className="min-w-0 rounded-lg border border-rule bg-paper-2 px-5 py-6 sm:px-7"
      >
        <h2
          id="coverage-heading"
          className="font-display text-xs font-semibold uppercase tracking-widest text-primary"
        >
          {t("coverageTitle")}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          {t("coverageBody", { total, containers })}
        </p>
        <p className="mt-3 max-w-3xl text-xs leading-5 text-muted">
          {t("sourceNote", {
            date: formatDate(RECYCLING_SNAPSHOT.fetchedAt, locale),
          })}{" "}
          <a
            href={RECYCLING_SNAPSHOT.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            OpenStreetMap · {RECYCLING_SNAPSHOT.license}
          </a>
        </p>
      </section>

      <RecyclingPointsMap points={RECYCLING_POINTS} />

      <Section id="danh-sach-diem" title={t("listTitle")} tone="ruled">
        <ul
          data-testid="recycling-list"
          className="divide-y divide-rule rounded-md border border-edge bg-paper"
        >
          {RECYCLING_POINTS.map((point) => {
            const isContainer = point.recyclingType === "container";
            return (
              <li key={point.id} className="min-w-0 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isContainer
                        ? "bg-paper-2 text-primary"
                        : "border border-edge text-muted"
                    }`}
                  >
                    {isContainer ? t("typeContainer") : t("typeUnspecified")}
                  </span>
                  <h3 className="font-display text-base font-bold text-ink [overflow-wrap:anywhere]">
                    {point.name ?? t("unnamed")}
                  </h3>
                </div>

                <p className="mt-2 text-sm leading-6 text-muted">
                  <span className="font-semibold text-ink">
                    {t("materialsLabel")}
                  </span>{" "}
                  {point.materials.length > 0
                    ? point.materials
                        .map((m) => materialLabel(m, locale))
                        .join(", ")
                    : t("materialsUnknown")}
                </p>

                {point.operator ? (
                  <p className="mt-1 text-sm leading-6 text-muted">
                    <span className="font-semibold text-ink">
                      {t("operatorLabel")}
                    </span>{" "}
                    {point.operator}
                  </p>
                ) : null}

                <p className="mt-2 text-xs tabular-nums text-muted">
                  {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
                </p>

                <a
                  href={osmUrl(point.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
                  // Every row shows the same link text, so the accessible name
                  // has to say which record it opens.
                  aria-label={t("viewOnOsmFor", {
                    name: point.name ?? point.id,
                  })}
                >
                  {t("viewOnOsm")}
                </a>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
