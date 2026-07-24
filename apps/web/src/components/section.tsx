import type { ReactNode } from "react";

type SectionTone = "ruled" | "open" | "band";

type SectionProps = {
  id: string;
  title: string;
  children: ReactNode;
  /** Optional one-line standfirst under the heading. */
  lede?: ReactNode;
  /**
   * Vertical rhythm. Every section sharing one treatment is what made this page
   * read as generated, so the page alternates:
   * - `ruled` — hairline rule above, the quiet default
   * - `open`  — no rule, wider air, for a section that should breathe
   * - `band`  — tinted full-bleed ground, for a section that should land
   */
  tone?: SectionTone;
  className?: string;
};

const TONE_SHELL: Record<SectionTone, string> = {
  ruled: "border-t border-rule pt-8 sm:pt-10",
  open: "pt-12 sm:pt-16",
  // `band-bleed` (globals.css) paints the tint out to the page edges without
  // widening the box — see the note there on why viewport units are wrong.
  band: "band-bleed bg-paper-2 py-10 sm:py-14",
};

/** Landmark section with a labelled heading. */
export function Section({
  id,
  title,
  children,
  lede,
  tone = "ruled",
  className = "",
}: SectionProps) {
  const headingId = `${id}-heading`;
  const inner = (
    <>
      <h2
        id={headingId}
        className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl"
      >
        {title}
      </h2>
      {lede ? (
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted sm:text-base">
          {lede}
        </p>
      ) : null}
      <div className="mt-5 min-w-0">{children}</div>
    </>
  );

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`min-w-0 ${TONE_SHELL[tone]} ${className}`.trim()}
    >
      {inner}
    </section>
  );
}
