"use client";

import { animate, useMotionValue, useReducedMotion, useTransform, motion } from "framer-motion";
import { useEffect } from "react";
import type { Verdict } from "@vibeguard/core";
import { VERDICT_STROKE } from "@/lib/ui";

const SIZE = 168;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The headline number: an arc that fills to the score and a digit that counts
 * up to it.
 *
 * The number is the accessible value — the arc is `aria-hidden` and the whole
 * gauge carries a `meter` role, so a screen reader gets "42 out of 100, block"
 * rather than a description of an SVG. With reduced motion the final state is
 * rendered immediately instead of animated.
 */
export function ScoreGauge({ score, verdict }: { score: number; verdict: Verdict }) {
  const reduceMotion = useReducedMotion();
  const progress = useMotionValue(reduceMotion ? score : 0);

  const offset = useTransform(progress, (value) => CIRCUMFERENCE * (1 - value / 100));
  const display = useTransform(progress, (value) => Math.round(value).toString());

  useEffect(() => {
    if (reduceMotion) {
      progress.set(score);
      return;
    }
    const controls = animate(progress, score, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [score, progress, reduceMotion]);

  const stroke = VERDICT_STROKE[verdict];

  return (
    <div
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${score} out of 100 — ${verdict}`}
      aria-label="Ship readiness score"
      className="relative grid shrink-0 place-items-center"
      style={{ width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} aria-hidden className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={STROKE}
        />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={stroke}
          strokeWidth={STROKE}
          strokeLinecap="butt"
          strokeDasharray={CIRCUMFERENCE}
          style={{ strokeDashoffset: offset }}
        />
      </svg>

      <div className="absolute inset-0 grid place-items-center">
        <motion.span
          aria-hidden
          className="display-heading text-5xl tabular-nums"
          style={{ color: stroke }}
        >
          {display}
        </motion.span>
        <span
          aria-hidden
          className="mt-14 absolute font-mono text-[10px] uppercase tracking-[0.18em] text-fg-muted"
        >
          / 100
        </span>
      </div>
    </div>
  );
}
