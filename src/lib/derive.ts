import { REGIONS, type Participant, type Region } from "./types";
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
