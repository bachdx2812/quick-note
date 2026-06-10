/**
 * Inline calculator (Antinote-style delight).
 * Evaluates a pure arithmetic expression; returns a finite number or null.
 */
export function evalMath(input: string): number | null {
  const expr = input.trim();
  if (!expr) return null;
  // Require at least one operator so a bare number isn't echoed as "= n".
  if (!/[+\-*/%]/.test(expr)) return null;
  // Whitelist: digits, operators, parentheses, dot, spaces. (Makes the
  // Function() eval below safe — no identifiers, calls, or side effects.)
  if (!/^[0-9+\-*/%().\s]+$/.test(expr)) return null;
  try {
    const result = Function(`"use strict";return(${expr})`)();
    return typeof result === "number" && isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

/** Format a computed result, trimming float noise. */
export function formatResult(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1e6) / 1e6);
}
