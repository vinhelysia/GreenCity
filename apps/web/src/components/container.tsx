import type { ReactNode } from "react";

type ContainerProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
};

/** Max-width content column used by shell and page sections. */
export function Container({
  children,
  className = "",
  as: Tag = "div",
}: ContainerProps) {
  return (
    <Tag className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`.trim()}>
      {children}
    </Tag>
  );
}
