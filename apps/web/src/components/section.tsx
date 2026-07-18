import type { ReactNode } from "react";

type SectionProps = {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
};

/** Landmark section with labelled heading for homepage editorial stack. */
export function Section({ id, title, children, className = "" }: SectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`min-w-0 border-t border-rule pt-8 sm:pt-10 ${className}`.trim()}
    >
      <h2
        id={headingId}
        className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl"
      >
        {title}
      </h2>
      <div className="mt-4 min-w-0">{children}</div>
    </section>
  );
}
