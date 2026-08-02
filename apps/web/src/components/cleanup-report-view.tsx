"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useState,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CreateCleanupReportSchema,
  type CleanupReportDto,
  type CleanupReportStatus,
  type ReverseGeocodeResult,
} from "@greencity/shared";
import { useAuth } from "@/components/auth-provider";
import { EcoBadge } from "@/components/eco-badge";
import { EmptyState } from "@/components/empty-state";
import { LocationPicker, type Coords } from "@/components/location-picker";
import { ReportCoordinates } from "@/components/report-coordinates";
import { SignInRequired } from "@/components/sign-in-required";
import {
  checkAuthExpiry,
  fetchMyCleanupReports,
  firstFieldErrors,
  marketplaceErrorMessage,
  mediaUrl,
  postCleanupReport,
  uploadMedia,
} from "@/lib/api";

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

const STATUS_VARIANT: Record<CleanupReportStatus, "mint" | "primary" | "coral"> = {
  SUBMITTED: "mint",
  VERIFIED: "primary",
  REJECTED: "coral",
};

function StatusBadge({ status }: { status: CleanupReportStatus }) {
  const tCleanup = useTranslations("cleanup");
  const labels: Record<CleanupReportStatus, string> = {
    SUBMITTED: tCleanup("statusPending") || "Chờ xác minh",
    VERIFIED: tCleanup("statusVerified") || "Đã xác minh (+50 điểm)",
    REJECTED: tCleanup("statusRejected") || "Từ chối",
  };

  return (
    <EcoBadge variant={STATUS_VARIANT[status]} className="text-xs uppercase tracking-wider">
      {labels[status]}
    </EcoBadge>
  );
}

export function CleanupReportView() {
  const tCommon = useTranslations("common");
  const { status: authStatus, clearSessionAndRedirect } = useAuth();
  const [refreshCounter, setRefreshCounter] = useState(0);

  if (authStatus === "loading") {
    return (
      <p role="status" className="text-sm text-muted">
        {tCommon("loading")}
      </p>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <SignInRequired
        testId="cleanup-login-required"
        actionKey="actionReportDumping"
      />
    );
  }

  return (
    <div className="min-w-0 space-y-8">
      <SubmitCleanupReportForm
        clearSessionAndRedirect={clearSessionAndRedirect}
        onSubmitted={() => setRefreshCounter((n) => n + 1)}
      />
      <MyCleanupReports
        refreshKey={refreshCounter}
        clearSessionAndRedirect={clearSessionAndRedirect}
      />
    </div>
  );
}

function SubmitCleanupReportForm({
  clearSessionAndRedirect,
  onSubmitted,
}: {
  clearSessionAndRedirect: () => void;
  onSubmitted: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("cleanup");
  const tVal = useTranslations("validation");

  const descriptionId = useId();
  const photoId = useId();
  const addressId = useId();
  const wardId = useId();
  const districtId = useId();
  const cityId = useId();
  const statusId = useId();

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<
    "idle" | "submitting" | "success"
  >("idle");

  const [photoState, setPhotoState] = useState<
    | { status: "idle" }
    | { status: "uploading" }
    | { status: "done"; mediaAssetId: string; previewUrl: string }
    | { status: "error"; message: string }
  >({ status: "idle" });

  const [coords, setCoords] = useState<Coords | null>(null);
  // Controlled so reverse geocoding can fill them, while the reporter stays
  // free to correct anything it gets wrong.
  const [addressLine, setAddressLine] = useState("");
  const [ward, setWard] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");

  const onAddressResolved = useCallback((result: ReverseGeocodeResult) => {
    // Only fill blanks: a lookup must never overwrite what someone typed.
    if (result.addressLine) setAddressLine((v) => v || result.addressLine!);
    if (result.ward) setWard((v) => v || result.ward!);
    if (result.district) setDistrict((v) => v || result.district!);
    if (result.city) setCity((v) => v || result.city!);
  }, []);

  async function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPhotoState({ status: "uploading" });
    const result = checkAuthExpiry(
      await uploadMedia(file),
      clearSessionAndRedirect,
    );
    if (!result.ok) {
      URL.revokeObjectURL(previewUrl);
      setPhotoState({
        status: "error",
        message: marketplaceErrorMessage(result.error, locale),
      });
      return;
    }
    setPhotoState({ status: "done", mediaAssetId: result.data.id, previewUrl });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    setFieldErrors({});

    const form = event.currentTarget;
    const fd = new FormData(form);
    const description = String(fd.get("description") ?? "").trim();

    const raw = {
      description,
      mediaAssetId: photoState.status === "done" ? photoState.mediaAssetId : "",
      ...(addressLine.trim() ? { addressLine: addressLine.trim() } : {}),
      ...(ward.trim() ? { ward: ward.trim() } : {}),
      ...(district.trim() ? { district: district.trim() } : {}),
      ...(city.trim() ? { city: city.trim() } : {}),
      // Both or neither — the schema and a DB CHECK both enforce it.
      ...(coords
        ? { latitude: coords.latitude, longitude: coords.longitude }
        : {}),
    };

    const parsed = CreateCleanupReportSchema.safeParse(raw);
    if (!parsed.success) {
      const flat = firstFieldErrors(parsed.error.flatten().fieldErrors);
      const localized: Record<string, string> = {};
      for (const [key, msg] of Object.entries(flat)) {
        if (key === "description")
          localized[key] = locale === "en" ? "Description must be 10-1000 characters." : "Mô tả phải từ 10 đến 1000 ký tự.";
        else if (key === "mediaAssetId")
          localized[key] = tVal("required");
        else localized[key] = msg;
      }
      setFieldErrors(localized);
      return;
    }

    setSubmitState("submitting");
    const result = checkAuthExpiry(
      await postCleanupReport(parsed.data),
      clearSessionAndRedirect,
    );
    if (!result.ok) {
      setServerError(marketplaceErrorMessage(result.error, locale));
      setSubmitState("idle");
      return;
    }

    setSubmitState("success");
    setPhotoState((prev) => {
      if (prev.status === "done") URL.revokeObjectURL(prev.previewUrl);
      return { status: "idle" };
    });
    form.reset();
    // form.reset() only clears uncontrolled inputs; these are React state.
    setCoords(null);
    setAddressLine("");
    setWard("");
    setDistrict("");
    setCity("");
    onSubmitted();
  }

  const descriptionError = fieldErrors.description;

  return (
    <section aria-labelledby="cleanup-form-heading" className="min-w-0">
      <h2
        id="cleanup-form-heading"
        className="font-display text-xl font-semibold tracking-tight text-ink"
      >
        {t("formTitle")}
      </h2>
      <form
        className="mt-4 flex max-w-md min-w-0 flex-col gap-5"
        onSubmit={onSubmit}
        noValidate
        aria-describedby={statusId}
      >
        <div>
          <label
            htmlFor={photoId}
            className="block text-sm font-medium text-ink"
          >
            {t("photoLabel")}
          </label>
          <input
            id={photoId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            disabled={
              submitState === "submitting" || photoState.status === "uploading"
            }
            onChange={(event) => void onPhotoChange(event)}
            className="mt-1.5 block w-full min-w-0 text-sm text-ink file:mr-3 file:min-h-11 file:rounded-md file:border file:border-edge file:bg-paper file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink"
          />
          <div role="status" className="mt-2 text-sm text-muted">
            {photoState.status === "uploading" ? (locale === "en" ? "Uploading image..." : "Đang tải ảnh lên…") : null}
            {photoState.status === "error" ? (
              <span role="alert" className="text-red-800">
                {photoState.message}
              </span>
            ) : null}
            {photoState.status === "done" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoState.previewUrl}
                alt="Selected site preview"
                className="mt-1 h-24 w-24 rounded-md border border-edge object-cover"
              />
            ) : null}
          </div>
          {fieldErrors.mediaAssetId ? (
            <p className="mt-1.5 text-sm text-red-800" role="alert">
              {fieldErrors.mediaAssetId}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor={descriptionId}
            className="block text-sm font-medium text-ink"
          >
            {t("descLabel")}
          </label>
          <textarea
            id={descriptionId}
            name="description"
            required
            minLength={10}
            maxLength={1000}
            rows={4}
            disabled={submitState === "submitting"}
            aria-invalid={descriptionError ? true : undefined}
            aria-describedby={
              descriptionError ? `${descriptionId}-error` : undefined
            }
            className="mt-1.5 w-full min-w-0 rounded-md border border-edge bg-paper px-3 py-2 text-base text-ink"
            placeholder={t("descPlaceholder")}
          />
          {descriptionError ? (
            <p
              id={`${descriptionId}-error`}
              className="mt-1.5 text-sm text-red-800"
              role="alert"
            >
              {descriptionError}
            </p>
          ) : null}
        </div>

        <LocationPicker
          value={coords}
          onChange={setCoords}
          onAddressResolved={onAddressResolved}
          disabled={submitState === "submitting"}
        />

        <div>
          <label
            htmlFor={addressId}
            className="block text-sm font-medium text-ink"
          >
            {t("locationLabel")}
          </label>
          <input
            id={addressId}
            name="addressLine"
            type="text"
            maxLength={240}
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            disabled={submitState === "submitting"}
            className="mt-1.5 min-h-11 w-full rounded-md border border-edge bg-paper px-3 py-2 text-base text-ink"
            placeholder={t("locationPlaceholder")}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor={wardId}
              className="block text-sm font-medium text-ink"
            >
              {locale === "en" ? "Ward" : "Phường"}
            </label>
            <input
              id={wardId}
              name="ward"
              type="text"
              maxLength={120}
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              disabled={submitState === "submitting"}
              className="mt-1.5 min-h-11 w-full rounded-md border border-edge bg-paper px-3 py-2 text-base text-ink"
            />
          </div>

          <div>
            <label
              htmlFor={districtId}
              className="block text-sm font-medium text-ink"
            >
              {locale === "en" ? "District" : "Quận"}
            </label>
            <input
              id={districtId}
              name="district"
              type="text"
              maxLength={120}
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              disabled={submitState === "submitting"}
              className="mt-1.5 min-h-11 w-full rounded-md border border-edge bg-paper px-3 py-2 text-base text-ink"
            />
          </div>

          <div>
            <label
              htmlFor={cityId}
              className="block text-sm font-medium text-ink"
            >
              {locale === "en" ? "City" : "Thành phố"}
            </label>
            <input
              id={cityId}
              name="city"
              type="text"
              maxLength={120}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={submitState === "submitting"}
              className="mt-1.5 min-h-11 w-full rounded-md border border-edge bg-paper px-3 py-2 text-base text-ink"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={
            submitState === "submitting" || photoState.status === "uploading"
          }
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-paper transition-opacity duration-quick ease-out hover:opacity-90 disabled:opacity-60"
        >
          {submitState === "submitting" ? t("submitting") : t("submitReport")}
        </button>

        {serverError ? (
          <p role="alert" className="text-sm leading-relaxed text-red-800">
            {serverError}
          </p>
        ) : null}

        <p
          id={statusId}
          role="status"
          className="text-sm leading-relaxed text-muted"
        >
          {submitState === "success"
            ? (locale === "en" ? "Report submitted successfully. See history below." : "Đã gửi báo cáo. Xem trong danh sách bên dưới.")
            : null}
        </p>
      </form>
    </section>
  );
}

function MyCleanupReports({
  refreshKey,
  clearSessionAndRedirect,
}: {
  refreshKey: number;
  clearSessionAndRedirect: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("cleanup");
  const [state, setState] = useState<LoadState<CleanupReportDto[]>>({
    status: "loading",
  });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const result = checkAuthExpiry(
      await fetchMyCleanupReports(),
      clearSessionAndRedirect,
    );
    if (!result.ok) {
      setState({
        status: "error",
        message: marketplaceErrorMessage(result.error, locale),
      });
      return;
    }
    setState({ status: "ready", data: result.data.reports });
  }, [clearSessionAndRedirect, locale]);

  useEffect(() => {
    void load();
  }, [refreshKey, load]);

  return (
    <section aria-labelledby="my-cleanup-heading" className="min-w-0">
      <h2
        id="my-cleanup-heading"
        className="font-display text-xl font-semibold tracking-tight text-ink"
      >
        {t("myReportsTitle")}
      </h2>
      <div className="mt-4" role="status" aria-live="polite">
        {state.status === "loading" ? (
          <div aria-hidden="true" className="flex flex-col gap-3">
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-24 w-full" />
          </div>
        ) : state.status === "error" ? (
          <p role="alert" className="text-sm leading-relaxed text-red-800">
            {state.message}
          </p>
        ) : state.data.length === 0 ? (
          <EmptyState
            testId="my-cleanup-reports-empty"
            title={locale === "en" ? "No reports submitted yet" : "Chưa có báo cáo nào"}
            description={t("noReports")}
          />
        ) : (
          <ul className="flex min-w-0 flex-col gap-4">
            {state.data.map((report) => {
              const locationText = [
                report.addressLine,
                report.ward,
                report.district,
                report.city,
              ]
                .filter(Boolean)
                .join(", ");

              return (
                <li
                  key={report.id}
                  className="min-w-0 rounded-md border border-edge bg-paper p-4"
                >
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={mediaUrl(report.media.downloadPath)}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-md border border-edge object-cover"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{report.description}</p>
                        {locationText ? (
                          <p className="mt-1 text-sm text-muted">
                            {locale === "en" ? "Location: " : "Địa điểm: "}{locationText}
                          </p>
                        ) : null}
                        <ReportCoordinates
                          latitude={report.latitude}
                          longitude={report.longitude}
                        />
                      </div>
                    </div>
                    <StatusBadge status={report.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
