"use client";

import { useEffect, useRef } from "react";
import type * as LeafletNS from "leaflet";
import type { RecyclingPoint } from "@/data/recycling-points";
import "leaflet/dist/leaflet.css";

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
}: {
  points: RecyclingPoint[];
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { scrollWheelZoom: false });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        // Required by the OpenStreetMap tile usage policy.
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

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
    <div
      ref={containerRef}
      role="group"
      aria-label={label}
      data-testid="recycling-map"
      className="h-80 w-full overflow-hidden rounded-md border border-edge bg-paper-2 sm:h-96"
    />
  );
}
