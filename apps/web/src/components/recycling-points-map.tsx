"use client";

import { useEffect, useRef, useState } from "react";
import type * as LeafletNS from "leaflet";
import type { RecyclingPoint } from "@/data/recycling-points";
import "leaflet/dist/leaflet.css";

/**
 * Leaflet asks for one image per visible grid cell, so a tile host that cannot
 * be reached produces a burst of failures rather than one. Waiting for a few
 * keeps a single dropped tile — normal on a flaky connection — from replacing a
 * map that is otherwise fine.
 */
const TILE_FAILURES_BEFORE_GIVING_UP = 4;

/**
 * An illustration of the list beside it: every point drawn here is also
 * rendered as text, and that list is what screen reader users read, because a
 * Leaflet canvas cannot carry this information on its own.
 *
 * Not aria-hidden, though it was at first. Leaflet renders real focusable
 * controls inside the container — the zoom links and the attribution link — and
 * hiding their container from assistive tech while leaving them in the tab
 * order is the aria-hidden-focus violation axe flags. `inert` would fix the
 * tree at the cost of blocking mouse interaction too, which would leave a map
 * nobody can pan. So the container stays in the tree and gets a name.
 */
export function RecyclingPointsMap({
  points,
  label,
  tilesUnavailableLabel,
}: {
  points: RecyclingPoint[];
  label: string;
  /** Shown over the map when the tile host cannot be reached. */
  tilesUnavailableLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { scrollWheelZoom: false });
      mapRef.current = map;

      const tiles = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          // Required by the OpenStreetMap tile usage policy.
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      ).addTo(map);

      /**
       * Without this the page degrades silently into an empty grey square, and
       * a reader has no way to tell a map that failed from a map with nothing
       * on it. Detaching the layer also stops Leaflet re-requesting tiles on
       * every pan and zoom, so an unreachable host cannot keep generating
       * failed requests for as long as the page is open. The markers, the point
       * list and the source note are all local, and stay.
       *
       * The condition is "no tile has ever arrived", not merely "some tiles
       * failed". A partly drawn map is still a usable map, and the failures
       * that produce one are exactly the transient kind this notice would be
       * wrong about.
       */
      let tileFailures = 0;
      let tilesDrawn = 0;

      tiles.on("tileload", () => {
        tilesDrawn += 1;
      });

      tiles.on("tileerror", () => {
        if (cancelled || tilesDrawn > 0) return;
        tileFailures += 1;
        if (tileFailures < TILE_FAILURES_BEFORE_GIVING_UP) return;

        tiles.off();
        map.removeLayer(tiles);
        setTilesUnavailable(true);
      });

      // A div icon instead of Leaflet's default PNG: bundlers rewrite the image
      // paths and silently break the marker. Containers are filled, unspecified
      // points are hollow, so the map makes the same distinction the list does.
      const dot = (container: boolean) =>
        L.divIcon({
          className: "",
          html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${
            container ? "#1F7A4D" : "#fff"
          };border:3px solid ${container ? "#fff" : "#1F7A4D"};box-shadow:0 2px 8px rgba(0,0,0,.35)"></span>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

      for (const p of points) {
        L.marker([p.lat, p.lon], {
          icon: dot(p.recyclingType === "container"),
          keyboard: false,
        }).addTo(map);
      }

      if (points.length > 0) {
        map.fitBounds(
          L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number])),
          { padding: [40, 40], maxZoom: 14 },
        );
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Points come from a committed snapshot and never change at runtime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // The notice is a sibling of the Leaflet container rather than a child:
    // Leaflet owns the DOM inside the element it is handed, and React removing
    // a child from underneath it is how a map ends up half-initialised.
    <div className="relative min-w-0">
      <div
        ref={containerRef}
        role="group"
        aria-label={label}
        data-testid="recycling-map"
        className="h-80 w-full overflow-hidden rounded-md border border-edge bg-paper-2 sm:h-96"
      />
      {tilesUnavailable ? (
        <p
          // Polite, not assertive: the map is decorative next to the list, so
          // this should not interrupt whatever is being read.
          role="status"
          data-testid="recycling-map-tiles-unavailable"
          className="pointer-events-none absolute inset-x-3 top-3 z-[1000] rounded-md border border-edge bg-card/95 px-3 py-2 text-sm leading-6 text-muted shadow-eco-sm"
        >
          {tilesUnavailableLabel}
        </p>
      ) : null}
    </div>
  );
}
