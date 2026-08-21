import type {
  CirculationInputs,
  CirculationSnapshot,
  DisasterInputs,
  ElectionInputs,
  HeadRole,
  Indicators,
  Round,
  RoundFlow,
  RoundInputs,
  RoundResults,
  TreasuryResult,
  Region,
} from "./types";

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
export const BANK_FEES: { ptc: number; lux: number; moving: number; transfer: number; guardPost: number };
export const REGIONS: Region[];
export const HEADROLES: HeadRole[];
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
export function disasterLevyAssessedPerRegion(dis: Partial<DisasterInputs>): number;
export function disasterLevyRows(
  dis: Partial<DisasterInputs>
): { region: Region; assessed: number; collected: number; shortfall: number; inKind: number }[];
export function disasterLevyCollectedTotal(dis: Partial<DisasterInputs>): number;
export function roundFlow(round: Round, prevRound: Round | undefined, level: number): RoundFlow;
export const MEMBER_STARTING_ALLOWANCE: number;
export function startingPayments(level: number): Record<HeadRole, number>;
export function computeCirculation(ctx: {
  rounds: Record<number, Round>;
  currentRound: number;
  level: number;
  /** [Red, Yellow, Blue, Green] living counts — only needed if MEMBER_STARTING_ALLOWANCE is non-zero. */
  regionLiving?: number[];
}): CirculationSnapshot;

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
export function defaultCirculation(): CirculationInputs;
