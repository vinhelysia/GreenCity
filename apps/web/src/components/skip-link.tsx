import { getTranslations } from "next-intl/server";

/** Skip to main content — first focusable control in the document. */
export async function SkipLink() {
  const t = await getTranslations("common");

  return (
    <a href="#noi-dung" className="skip-link">
      {t("skipToContent")}
    </a>
  );
}
