export const REGIONS = ["Red", "Yellow", "Blue", "Green"] as const;
export type Region = (typeof REGIONS)[number];

export const HEADROLES = [
  "BASIN",
  "RETSIN",
  "POP",
  "SOP",
  "EMPIN",
  "HUMSERV",
  "MASMED",
  "JUDCO",
] as const;
export type HeadRole = (typeof HEADROLES)[number];

export const HEADREGION: Record<HeadRole, Region> = {
  BASIN: "Green",
  JUDCO: "Green",
  POP: "Green",
  RETSIN: "Yellow",
  SOP: "Yellow",
  HUMSERV: "Yellow",
  MASMED: "Blue",
  EMPIN: "Blue",
};

export type AttendanceCode = "P" | "A" | "E" | "D"; // E = unemployed (shown as "U")

export type SessionMark = {
  status?: AttendanceCode | null;
  ns?: boolean;
};

export type Participant = {
  id: string;
  game_id: string;
  name: string;
  region: Region | null;
  team: string | null;
  role: string | null;
  age: string | null;
  gender: string | null;
  job: string | null;
  lux: boolean;
  ptc: boolean;
  sessions: Record<string, SessionMark>;
};

export type GameHeads = Partial<Record<HeadRole, string | null>>;

export type RegionAmounts = Record<Region, number>;

export type DisasterInputs = {
  title: string;
  dFES: number;
  dSL: number;
  dSC: number;
  dPC: number;
  subForfeit: number;
  levy: number;
  // Coordinator-entered actual cash collected per region, against the levy
  // assessed evenly across the four regions (levy / 4). Absent/undefined for
  // a region means "assume fully collected" (backward compat with rounds
  // saved before this field existed).
  levyCollected: Partial<RegionAmounts>;
  // Subsistence cards forfeited in lieu of cash, per region. Informational
  // only — never counted as money in the circulation total.
  inKind: Partial<RegionAmounts>;
  closures: string;
  rules: string;
};

export type ElectionInputs = {
  announce: boolean;
  winner: "" | "POP" | "SOP";
  levyPerMember: number;
  levyFlat: number;
  // Coordinator-entered actual cash collected per region, against the
  // assessed levy (members * levyPerMember + levyFlat). Absent means
  // "assume fully collected" (backward compat).
  levyCollected: Partial<RegionAmounts>;
  inKind: Partial<RegionAmounts>;
  dFES: number;
  dSL: number;
  dSC: number;
  dPC: number;
  notes: string;
};

export type CirculationRemoval = { label: string; amount: number };
export type CirculationInjection = { label: string; amount: number };

export type CirculationInputs = {
  // Coordinator-counted cash currently held in each region — a snapshot,
  // re-entered/updated as often as they physically check.
  regionCash: RegionAmounts;
  // Coordinator-counted override per group treasury. A group absent from
  // this map falls back to the derived (opening + income − spending) value.
  groupCash: Partial<Record<HeadRole, number>>;
  // Bank fee counts (not dollars) for this round: PTC issued, Luxury Living
  // Endowment, moving fee, PTC transfer. Multiplied by fixed $ amounts
  // (BANK_FEES in simsoc-engine.js). Guard-post fees reuse the existing
  // `guardPosts` tally rather than duplicating a count here.
  bankFees: { ptc: number; lux: number; moving: number; transfer: number };
  removals: CirculationRemoval[];
  injections: CirculationInjection[];
};

export type RoundInputs = {
  basinAssets: number | null;
  basinWithdrawn: number;
  basinPurchased: number | null;
  basinPassages: number;
  basinErrors: number;
  basinPassageErrors: number[];
  retsinAssets: number | null;
  retsinWithdrawn: number;
  retsinAnagramsIn: number;
  retsinWords: number;
  invRC: number;
  invWelfare: number;
  scPOP: number;
  scSOP: number;
  scEMPIN: number;
  scHUMSERV: number;
  scMASMED: number;
  rioters: number;
  guardPosts: number;
  arrests: number;
  goalsPos: number;
  goalsNeg: number;
  dis: DisasterInputs;
  elec: ElectionInputs;
  circulation: CirculationInputs;
};

export type Indicators = { FES: number; SL: number; SC: number; PC: number };

export type RoundResults = {
  level: number;
  pop: number;
  absentees: number;
  unemployed: number;
  deaths: number;
  rioters: number;
  guardPosts: number;
  arrests: number;
  indicators: Indicators;
  // Pre-floor computed indicators, and the amount the −30 floor absorbed
  // (clippedValue − rawValue, 0 when not clipped) for each indicator.
  raw: Indicators;
  absorbed: Indicators;
  minInd: number;
  mult: number | null;
  basinPay: number;
  retsinPay: number;
  basinNet: number;
  retsinNet: number;
  basinPassageCost: number;
  basic: Record<string, number>;
  net: Record<string, number>;
  nextRound: number;
  disaster: DisasterInputs | null;
  election: (ElectionInputs & { treasury: TreasuryResult }) | null;
};

export type TreasuryResult = {
  rows: { region: Region; members: number; assessed: number; collected: number; shortfall: number; inKind: number }[];
  // `total` is the collected total — the money actually redistributed. A
  // shortfall (assessed > collected) means the winning heads receive less,
  // per the Coordinator's Manual: levies are assessed, not auto-collected.
  total: number;
  totalAssessed: number;
  totalShortfall: number;
  recips: string[];
  share: number;
};

export type CirculationSnapshot = {
  level: number;
  round: number;
  regionCash: RegionAmounts;
  groupDerived: Record<HeadRole, number>;
  groupCashOverride: Partial<Record<HeadRole, number>>;
  groupTreasury: Record<HeadRole, number>;
  totalRegion: number;
  totalGroup: number;
  total: number;
  issuedTotal: number;
  removedTotal: number;
  flowTotal: number;
  variance: number;
};

export type RoundFlow = { issued: number; removed: number };

export type Round = {
  id: string;
  game_id: string;
  round_no: number;
  inputs: RoundInputs;
  results: RoundResults | null;
  closed: boolean;
};

/** A per-game participant rule. Reference text only — never read by the engine. */
export type Rule = {
  id: string;
  game_id: string;
  text: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type GameConfig = {
  numSessions: number;
  lockLevel: boolean;
  lockedLevel: number | null;
  sessionSort?: "roster" | "name" | "region";
};

export type Game = {
  id: string;
  name: string;
  owner_id: string;
  config: GameConfig;
  current_round: number;
  status_share_token: string;
  // Highest session number whose MasMed report has been released to players
  // (advanced by the coordinator's "Start next session" action). 0 = none yet.
  masmed_released_through: number;
  // Short human-typable code players enter on the login screen to reach the
  // status link. Null only until migration 0005 has run.
  player_code: string | null;
};
