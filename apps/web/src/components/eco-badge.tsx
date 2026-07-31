import type { ReactNode } from "react";

type BadgeVariant =
  | "primary"
  | "mint"
  | "coral"
  | "yellow"
  | "gray"
  | "outline";

interface EcoBadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  icon?: ReactNode;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  primary: "bg-primary text-white border-transparent",
  mint: "bg-mint-surface text-primary border-primary/20",
  coral: "bg-coral/10 text-coral border-coral/30",
  yellow: "bg-yellow/20 text-ink border-yellow/40",
  gray: "bg-paper-2 text-muted border-edge",
  outline: "bg-transparent text-ink border-edge",
};

export function EcoBadge({
  children,
  variant = "mint",
  className = "",
  icon,
}: EcoBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors ${VARIANT_STYLES[variant]} ${className}`}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </span>
  );
}
