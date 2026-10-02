"use client";

import { useState, type ComponentProps } from "react";
import { MorphIcon, type MorphIconProps } from "morphicons/react";
import { Link } from "@/i18n/routing";
import { ECO_ARROW_PATH, ECO_PACKAGE_PATH } from "./eco-icons";

export const MORPH_PATHS = {
  arrow: ECO_ARROW_PATH,
  package: ECO_PACKAGE_PATH,
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M6 18 18 6",
  home: "M3 10l9-7 9 7M5 9v12h14V9M9 21v-8h6v8",
  bin: "M3 6h18M5 6v14h14V6M9 6V3h6v3M10 10v7M14 10v7",
  truck: "M1 4h13v13H1ZM14 9h4l4 4v4h-8M5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4M18 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  store: "M3 3h18l1 6H2ZM3 9v12h18V9M9 21v-8h6v8",
  points: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM8 12l3 3 5-6",
  price: "M3 3h8l10 10-8 8L3 11ZM7 7h.01",
  camera: "M3 6h4l2-3h6l2 3h4v15H3ZM12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  quote: "M5 3h14v18H5ZM8 7h8M8 11h8M8 15h4",
  calendar: "M3 5h18v16H3ZM3 10h18M7 3v4M17 3v4M8 15l3 3 5-5",
  check: "M5 12l4 4L19 6",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2",
  receipt: "M5 3l2 2 2-2 3 2 3-2 2 2 2-2v18l-2-2-2 2-3-2-3 2-2-2-2 2ZM8 9h8M8 13h8",
  phone: "M4 3h4l2 5-3 2a16 16 0 0 0 7 7l2-3 5 2v4c-9 3-20-8-17-17Z",
  refresh: "M20 7a8 8 0 0 0-14-2L3 8M3 3v5h5M4 17a8 8 0 0 0 14 2l3-3M21 21v-5h-5",
} as const;

export function EcoMorphIcon(props: Pick<MorphIconProps, "icon" | "className" | "size">) {
  return <MorphIcon size={20} spring="snappy" {...props} reducedMotion="user" aria-hidden="true" focusable="false" />;
}

/** The whole CTA responds to pointer and keyboard; its visible label stays put. */
export function MorphActionLink({ icon, children, ...props }: Omit<ComponentProps<typeof Link>, "onMouseEnter" | "onMouseLeave" | "onFocus" | "onBlur"> & { icon: keyof typeof MORPH_PATHS }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <Link {...props} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
      <EcoMorphIcon icon={hovered || focused ? MORPH_PATHS.arrow : MORPH_PATHS[icon]} className="h-5 w-5 shrink-0" />
      {children}
    </Link>
  );
}
