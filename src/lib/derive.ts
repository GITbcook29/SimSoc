import { REGIONS, type Indicators, type Participant, type Region } from "./types";
import { sizeLevel } from "./simsoc-engine.js";

export function isDead(p: Participant, upToRound: number): boolean {
  for (let r = 1; r <= upToRound; r++) {
    if (p.sessions?.[String(r)]?.status === "D") return true;
  }
  return false;
}

export function popCount(roster: Participant[], currentRound: number): number {
  return roster.filter((p) => !isDead(p, currentRound)).length;
}

export function currentLevel(
  roster: Participant[],
  currentRound: number,
  lockLevel: boolean,
  lockedLevel: number | null
): number {
  if (lockLevel && lockedLevel) return lockedLevel;
  return sizeLevel(popCount(roster, currentRound));
}

export function countStatus(roster: Participant[], round: number, code: string): number {
  return roster.reduce((n, p) => n + (p.sessions?.[String(round)]?.status === code ? 1 : 0), 0);
}

export function newDeaths(roster: Participant[], round: number): number {
  return roster.reduce((n, p) => n + (p.sessions?.[String(round)]?.status === "D" ? 1 : 0), 0);
}

export function livingByRegion(roster: Participant[], upToRound: number): number[] {
  return REGIONS.map(
    (reg) => roster.filter((p) => p.region === reg && !isDead(p, upToRound)).length
  );
}

export function regionOf(region: Region | null): Region {
  return region ?? "Red";
}

export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : n.toFixed(1);
}

export type IndicatorTier = "stable" | "watch" | "critical" | "collapsed";

const TIER_ORDER: IndicatorTier[] = ["stable", "watch", "critical", "collapsed"];

/**
 * Trajectory-based collapse warning, replacing the old flat level thresholds.
 * The engine's −30 floor means any indicator whose next-session starting
 * value (v * 0.9) is ≤30 can reach zero in a single round — that is the real
 * red line, not an arbitrary level. Projection uses only this round's drop
 * (prev − current), and only when the indicator actually fell.
 */
export function collapseTier(indicators: Indicators, prev: Indicators) {
  const perIndicator = {} as Record<
    keyof Indicators,
    { tier: IndicatorTier; nextStart: number; roundsToZero: number | null }
  >;
  let worst: IndicatorTier = "stable";

  (Object.keys(indicators) as (keyof Indicators)[]).forEach((k) => {
    const v = indicators[k];
    const nextStart = Math.round(v * 0.9 * 10) / 10;
    const drop = prev[k] - v;
    const roundsToZero = drop > 0 ? round1(nextStart / drop) : null;

    let tier: IndicatorTier;
    if (v < 0) tier = "collapsed";
    else if (nextStart <= 30 || v < 25) tier = "critical";
    else if (v < 50) tier = "watch";
    else if (roundsToZero !== null && roundsToZero <= 3) tier = "watch";
    else tier = "stable";

    perIndicator[k] = { tier, nextStart, roundsToZero };
    if (TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(worst)) worst = tier;
  });

  return { tier: worst, perIndicator };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
