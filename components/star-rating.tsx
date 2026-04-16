"use client";

import { useState } from "react";

const STARS = [1, 2, 3, 4, 5] as const;

type Props = {
  /** `null` = no selection (all stars dim). */
  value: number | null;
  onChange: (score: number) => void;
  /** Accessible name, e.g. creator name */
  label: string;
};

/**
 * Five-star control: inactive stars stay dim; selected stars use the accent color.
 * Hover previews the score before click.
 */
export function StarRating({ value, onChange, label }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const highlight = hover ?? value ?? 0;

  return (
    <div
      className="star-rating"
      role="radiogroup"
      aria-label={`${label} — score 1 to 5`}
    >
      {STARS.map((n) => {
        const on = n <= highlight;
        return (
          <button
            key={n}
            type="button"
            className={`star-rating__btn${on ? " star-rating__btn--on" : ""}`}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            aria-checked={value === n}
            role="radio"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
          >
            <span className="star-rating__glyph" aria-hidden>
              ★
            </span>
          </button>
        );
      })}
    </div>
  );
}
