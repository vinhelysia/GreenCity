import type { ReactNode } from "react";
import { EmptyState } from "./empty-state";

type FeatureUnavailableProps = {
  /**
   * Short status line. Required so it is always translated by the caller —
   * a default here would silently render one language on both locales.
   */
  status: string;
  title: string;
  description: ReactNode;
  testId?: string;
};

/** Shell for planned product areas that have no backend yet. */
export function FeatureUnavailable({
  status,
  title,
  description,
  testId,
}: FeatureUnavailableProps) {
  return (
    <div className="space-y-4">
      <p className="inline-flex items-center rounded-sm border border-edge bg-paper-2 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-muted">
        {status}
      </p>
      <EmptyState title={title} description={description} testId={testId} />
    </div>
  );
}
