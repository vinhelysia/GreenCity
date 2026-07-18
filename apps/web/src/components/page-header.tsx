import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
};

/** Consistent page title block — one h1 per page. */
export function PageHeader({ title, description, eyebrow }: PageHeaderProps) {
  return (
    <header className="max-w-prose">
      {eyebrow ? (
        <p className="text-sm font-medium tracking-wide text-accent">{eyebrow}</p>
      ) : null}
      <h1
        className={`font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl ${
          eyebrow ? "mt-2" : ""
        }`}
      >
        {title}
      </h1>
      {description ? (
        <div className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
          {description}
        </div>
      ) : null}
    </header>
  );
}
