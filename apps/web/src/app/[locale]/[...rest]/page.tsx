import { notFound } from "next/navigation";

// Rendered on demand, never prerendered. A statically generated catch-all is
// served as a 200 static document, which turns every unknown URL into a soft
// 404 — indexable by crawlers and indistinguishable from a real page.
export const dynamic = "force-dynamic";

export default function CatchAllNotFound() {
  notFound();
}
