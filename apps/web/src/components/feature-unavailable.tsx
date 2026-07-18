import type { ReactNode } from "react";
import { EmptyState } from "./empty-state";

type FeatureUnavailableProps = {
  /** Short status line, e.g. "Đang phát triển" */
  status?: string;
  title: string;
  description: ReactNode;
  testId?: string;
};

/** Shell for planned product areas that have no backend yet. */
export function FeatureUnavailable({
  status = "Đang phát triển",
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
