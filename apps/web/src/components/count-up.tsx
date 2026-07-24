"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 500;
const formatter = new Intl.NumberFormat("vi-VN");

/** Exponential ease-out, the curve --ease-out uses: fast, then settling. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * A figure that counts up to its value once, on the render that first shows it.
 *
 * This exists for one moment: an admin confirms a handover and the seller's
 * balance moves off zero. Watching it climb is what makes the reward feel
 * earned rather than merely displayed.
 *
 * The climbing digits are hidden from assistive tech and the settled value is
 * exposed instead, otherwise a live region would announce every frame.
 */
export function CountUp({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const target = value;
    const start = from.current;
    if (start === target) return;

    // A hidden tab gets no animation frames, so counting there would leave the
    // figure sitting at zero until the reader came back. Show the real number
    // straight away instead: the wrong value is a worse failure than no motion.
    const skip =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.visibilityState !== "visible";
    if (skip) {
      from.current = target;
      setShown(target);
      return;
    }

    const t0 = performance.now();
    let raf = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - t0) / DURATION_MS);
      setShown(start + (target - start) * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    });
    return () => cancelAnimationFrame(raf);
  }, [value]);

  // Match the target's precision so a whole number never flickers a decimal.
  const decimals = Number.isInteger(value) ? 0 : 1;

  return (
    <span className={className}>
      <span aria-hidden="true">
        {formatter.format(Number(shown.toFixed(decimals)))}
      </span>
      <span className="sr-only">{formatter.format(value)}</span>
    </span>
  );
}
