import { useEffect } from "react";
import { useMotionValue, useSpring, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";

/**
 * Returns a `MotionValue<string>` that smoothly animates toward the latest
 * `value` and renders with the requested number of decimal digits.
 */
export function useAnimatedNumber(
  value: number,
  decimals = 0
): MotionValue<string> {
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, {
    stiffness: 80,
    damping: 18,
    mass: 0.6,
  });
  const display = useTransform(spring, (v: number) => v.toFixed(decimals));

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  return display;
}
