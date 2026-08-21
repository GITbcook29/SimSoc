import type { DisasterInputs, ElectionInputs, Indicators, RoundInputs, RoundResults, TreasuryResult, Region } from "./types";

export const LV: {
  pop: number[];
  br: number[];
  other: number[];
  assets: number[];
  cost: number[];
  basinPay: number[];
  basinErr: number[];
  retsinWd: number[];
};
export const BASIN_CHARGE_FOR_PASSAGE_PURCHASES: boolean;
export const REGIONS: Region[];
export const HEADROLES: string[];
export const HEADREGION: Record<string, Region>;
export const ELECTION_RECIPIENTS: Record<string, string[]>;

export function sizeLevel(pop: number): number;
export function incomeMult(min: number): number | null;
export function riotEffect(pct: number): number;
export function basinPaymentLegacy(passages: number, errors: number, level: number): number;
export function basinPaymentPerPassage(errorsArr: number[], level: number): number;
export function basinPurchasedCount(inputs: RoundInputs): number;
export function basinAcceptablePassages(inputs: RoundInputs): number;
export function basinPaymentFromInputs(inputs: RoundInputs, level: number): number;
export function retsinPayment(anagramsIn: number, words: number, level: number): number;
export function electionTreasury(election: Partial<ElectionInputs>, regionLiving: number[]): TreasuryResult;

export function computeRound(ctx: {
  round: number;
  level: number;
  pop: number;
  prev: Indicators;
  counts: { absentees: number; unemployed: number; deaths: number };
  inputs: RoundInputs;
  regionLiving: number[];
}): RoundResults;

export function defaultInputs(): RoundInputs;
export function defaultDisaster(): DisasterInputs;
export function defaultElection(): ElectionInputs;
