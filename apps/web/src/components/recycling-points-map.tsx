"use client";

import { useEffect, useRef } from "react";
import type * as LeafletNS from "leaflet";
import type { RecyclingPoint } from "@/data/recycling-points";
import "leaflet/dist/leaflet.css";

/**
 * The map is decorative. Every point it draws is also rendered as text by the
 * list beside it, which is what screen reader and keyboard users read — a
 * Leaflet canvas cannot be made to carry this information on its own, so the
 * list is the content and this is the illustration.
 */
export function RecyclingPointsMap({ points }: { points: RecyclingPoint[] }) {
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
      aria-hidden="true"
      data-testid="recycling-map"
      className="h-80 w-full overflow-hidden rounded-md border border-edge bg-paper-2 sm:h-96"
    />
  );
}
