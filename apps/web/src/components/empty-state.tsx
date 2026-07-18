import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  /** Visible label for test/screenshot targeting */
  testId?: string;
};

/** Honest empty content — never invents product data. */
export function EmptyState({ title, description, testId }: EmptyStateProps) {
  return (
    <div
      data-testid={testId}
      className="rounded-md border border-dashed border-edge bg-paper-2 px-4 py-6 sm:px-6 sm:py-8"
    >
      <p className="font-medium text-ink">{title}</p>
      {description ? (
        <div className="mt-2 text-sm leading-relaxed text-muted">{description}</div>
      ) : null}
    </div>
  );
}
