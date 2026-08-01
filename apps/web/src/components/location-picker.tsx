"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type * as LeafletNS from "leaflet";
import { isWithinHcmc, type ReverseGeocodeResult } from "@greencity/shared";
import { reverseGeocode } from "@/lib/api";
import "leaflet/dist/leaflet.css";

export type Coords = { latitude: number; longitude: number };

/** Bến Thành market — a recognisable HCMC centre to open the map on. */
const DEFAULT_CENTER: Coords = { latitude: 10.7769, longitude: 106.7009 };

type GeoState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "denied" }
  | { kind: "unavailable" };

export function LocationPicker({
  value,
  onChange,
  onAddressResolved,
  disabled,
}: {
  value: Coords | null;
  onChange: (coords: Coords) => void;
  onAddressResolved: (result: ReverseGeocodeResult) => void;
  disabled?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("cleanup");
  const mapNodeId = useId();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const markerRef = useRef<LeafletNS.Marker | null>(null);
  const leafletRef = useRef<typeof LeafletNS | null>(null);
  // Read inside Leaflet event handlers, which are bound once and would
  // otherwise capture the first render's onChange forever.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [geoState, setGeoState] = useState<GeoState>({ kind: "idle" });
  const [lookingUp, setLookingUp] = useState(false);

  const outsideServiceArea =
    value !== null && !isWithinHcmc(value.latitude, value.longitude);

  /** Resolve a pin into address fields. Failure is silent: the coordinates are
   *  the real payload, and the address is a convenience the reporter can type. */
  const lookUpAddress = useCallback(
    async (coords: Coords) => {
      setLookingUp(true);
      const result = await reverseGeocode(coords.latitude, coords.longitude);
      setLookingUp(false);
      if (result.ok) onAddressResolved(result.data);
    },
    [onAddressResolved],
  );

  // Create the map once. Leaflet is imported here rather than at module scope
  // so it is never evaluated while the client component is prerendered on the
  // server, where there is no window for it to measure.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;

      const start = value ?? DEFAULT_CENTER;
      const map = L.map(containerRef.current, {
        center: [start.latitude, start.longitude],
        zoom: value ? 17 : 12,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        // Required by the OpenStreetMap tile usage policy.
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // A div icon instead of Leaflet's default PNG: bundlers rewrite the
      // image paths and silently break the marker, and this also lets the pin
      // carry the brand colour.
      const icon = L.divIcon({
        className: "",
        html: '<span style="display:block;width:22px;height:22px;border-radius:9999px;background:#C4451B;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([start.latitude, start.longitude], {
        draggable: true,
        icon,
        keyboard: true,
      }).addTo(map);
      markerRef.current = marker;

      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onChangeRef.current({ latitude: p.lat, longitude: p.lng });
      });

      map.on("click", (e: LeafletNS.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        onChangeRef.current({ latitude: e.latlng.lat, longitude: e.latlng.lng });
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Deliberately once: `value` seeds the initial view only. Re-running would
    // tear the map down mid-drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow external coordinate changes (the GPS button) without recreating the map.
  useEffect(() => {
    if (!value || !mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([value.latitude, value.longitude]);
    mapRef.current.setView([value.latitude, value.longitude], 17);
  }, [value]);

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setGeoState({ kind: "unavailable" });
      return;
    }
    setGeoState({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoState({ kind: "idle" });
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        onChange(coords);
        void lookUpAddress(coords);
      },
      (err) => {
        setGeoState(
          err.code === err.PERMISSION_DENIED
            ? { kind: "denied" }
            : { kind: "unavailable" },
        );
      },
      // The reporter is standing at the site, so precision is worth a few
      // seconds and the battery. A cached fix from another part of the city
      // would be worse than none.
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={disabled || geoState.kind === "locating"}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-eco-sm transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {geoState.kind === "locating" ? t("locating") : t("useMyLocation")}
        </button>
        {lookingUp ? (
          <span className="text-sm text-muted">{t("lookingUpAddress")}</span>
        ) : null}
      </div>

      <p className="mt-2 text-sm text-muted">{t("mapHint")}</p>

      <div
        id={mapNodeId}
        ref={containerRef}
        role="application"
        aria-label={t("mapLabel")}
        className="mt-2 h-64 w-full overflow-hidden rounded-xl border border-edge sm:h-72"
      />

      <div role="status" aria-live="polite" className="mt-2 space-y-1.5">
        {geoState.kind === "denied" ? (
          <p className="text-sm text-muted">{t("locationDenied")}</p>
        ) : null}
        {geoState.kind === "unavailable" ? (
          <p className="text-sm text-muted">{t("locationUnavailable")}</p>
        ) : null}

        {value ? (
          <p className="text-sm tabular-nums text-muted">
            {t("selectedCoords", {
              lat: value.latitude.toFixed(5),
              lng: value.longitude.toFixed(5),
            })}
          </p>
        ) : null}

        {outsideServiceArea ? (
          // A warning, never a block: a real dumping site outside the pilot
          // area is still worth recording.
          <p className="rounded-lg border border-warm-100 bg-warm-050 px-3 py-2 text-sm text-warm-900">
            {t("outsideServiceArea")}
          </p>
        ) : null}
      </div>

      <p className="sr-only">
        {locale === "en"
          ? "Map data from OpenStreetMap contributors."
          : "Dữ liệu bản đồ từ OpenStreetMap."}
      </p>
    </div>
  );
}
