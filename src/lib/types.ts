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

export type DisasterInputs = {
  title: string;
  dFES: number;
  dSL: number;
  dSC: number;
  dPC: number;
  subForfeit: number;
  levy: number;
  closures: string;
  rules: string;
};

export type ElectionInputs = {
  announce: boolean;
  winner: "" | "POP" | "SOP";
  levyPerMember: number;
  levyFlat: number;
  dFES: number;
  dSL: number;
  dSC: number;
  dPC: number;
  notes: string;
};

export type RoundInputs = {
  basinAssets: number | null;
  basinWithdrawn: number;
  basinPassages: number;
  basinErrors: number;
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
  minInd: number;
  mult: number | null;
  basinPay: number;
  retsinPay: number;
  basinNet: number;
  retsinNet: number;
  basic: Record<string, number>;
  net: Record<string, number>;
  nextRound: number;
  disaster: DisasterInputs | null;
  election: (ElectionInputs & { treasury: TreasuryResult }) | null;
};

export type TreasuryResult = {
  rows: { region: Region; members: number; amount: number }[];
  total: number;
  recips: string[];
  share: number;
};

export type Round = {
  id: string;
  game_id: string;
  round_no: number;
  inputs: RoundInputs;
  results: RoundResults | null;
  closed: boolean;
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
};
