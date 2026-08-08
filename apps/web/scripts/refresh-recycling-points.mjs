/**
 * Refreshes src/data/recycling-points.json from OpenStreetMap.
 *
 *   node scripts/refresh-recycling-points.mjs
 *
 * The snapshot is committed rather than fetched at request time: there are ~10
 * points in the whole city, they change on the order of months, and a demo that
 * depends on Overpass being up is a demo that breaks when Overpass is not.
 * `fetchedAt` in the output is what the page shows, so a stale snapshot is
 * visible to the reader instead of silently passing as current.
 *
 * Data © OpenStreetMap contributors, ODbL 1.0. Attribution is rendered on the
 * page and must stay there.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Ho Chi Minh City bounding box (south, west, north, east).
const BBOX = [10.3, 106.3, 11.25, 107.1];

const QUERY = `[out:json][timeout:90];
(
  node["amenity"="recycling"](${BBOX.join(",")});
  way["amenity"="recycling"](${BBOX.join(",")});
);
out center tags;`;

const out = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../src/data/recycling-points.json",
);

// Raw query body under a form content type, which is what curl --data-binary
// sends and what Overpass accepts; text/plain and an encoded `data=` field both
// come back 406. The User-Agent is required by Overpass's usage policy.
//
// Mirrors, because the main instance answers 504 under load often enough that a
// single-endpoint script is a script that mostly does not work.
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

async function fetchElements() {
  // `--from-file <overpass.json>` normalises an already-downloaded response.
  // Overpass 504s often enough that being able to feed it a response fetched
  // by hand (curl --data-binary @query) is the difference between a refresh
  // you can finish and one you retry all afternoon.
  const fromFile = process.argv.indexOf("--from-file");
  if (fromFile !== -1) {
    const path = process.argv[fromFile + 1];
    if (!path) {
      console.error("--from-file needs a path");
      process.exit(1);
    }
    console.log(`reading ${path}`);
    return JSON.parse(readFileSync(path, "utf8")).elements ?? [];
  }

  const failures = [];
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "GreenCity/1.0 (recycling point snapshot; contact via repo)",
        },
        body: QUERY,
      });
      if (!res.ok) {
        failures.push(`${endpoint} -> HTTP ${res.status}`);
        continue;
      }
      const body = await res.json();
      console.log(`fetched from ${endpoint}`);
      return body.elements ?? [];
    } catch (err) {
      failures.push(`${endpoint} -> ${err.message}`);
    }
  }
  console.error("every Overpass endpoint failed:");
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}

const elements = await fetchElements();

const points = elements
  .map((el) => {
    const tags = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== "number" || typeof lon !== "number") return null;
    return {
      id: `${el.type}/${el.id}`,
      lat: Number(lat.toFixed(6)),
      lon: Number(lon.toFixed(6)),
      name: tags.name ?? null,
      operator: tags.operator ?? null,
      // OSM's own vocabulary, not ours. "container" is a real bin; anything
      // else is a point somebody marked as recycling without saying what it is,
      // and the page says so rather than promoting it to a bin.
      recyclingType: tags.recycling_type ?? null,
      materials: Object.entries(tags)
        .filter(([k, v]) => k.startsWith("recycling:") && v === "yes")
        .map(([k]) => k.slice("recycling:".length))
        .sort(),
    };
  })
  .filter(Boolean)
  // Stable order so a refresh with no upstream change produces no diff.
  .sort((a, b) => a.id.localeCompare(b.id));

writeFileSync(
  out,
  `${JSON.stringify(
    {
      source: "OpenStreetMap, via the Overpass API",
      sourceUrl: "https://www.openstreetmap.org/copyright",
      license: "ODbL 1.0",
      area: "Ho Chi Minh City bounding box",
      bbox: BBOX,
      fetchedAt: new Date().toISOString(),
      points,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const containers = points.filter((p) => p.recyclingType === "container").length;
console.log(
  `wrote ${points.length} points (${containers} tagged as containers) to src/data/recycling-points.json`,
);
