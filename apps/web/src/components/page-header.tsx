import type { ReactNode } from "react";
import { EcoBadge } from "./eco-badge";

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
        <div className="mb-2">
          <EcoBadge variant="mint" className="font-semibold">
            {eyebrow}
          </EcoBadge>
        </div>
      ) : null}
      <h1 className="font-display text-3.5xl font-extrabold tracking-tight text-ink sm:text-4xl">
        {title}
      </h1>
      {description ? (
        <div className="mt-3 text-base leading-relaxed text-muted sm:text-lg">
          {description}
        </div>
      ) : null}
    </header>
  );
}
