/**
 * SIMSOC calculation engine — verified against the coordinator workbook.
 *
 * These are PURE functions: same inputs → same outputs, no DOM, no global state.
 * Copy this file into the web app as `lib/simsoc-engine.js` and call `computeRound()`
 * from your "Close Session" server action. DO NOT rewrite the math — it is already
 * checked against the workbook formulas (sizeLevel, incomeMult tiers, riot table,
 * basin/retsin pay, the −30 indicator floor, disaster & election shocks).
 *
 * Verified reference cases (see tests at bottom):
 *   - Session 1 indicators are always 100/100/100/100, multiplier ×1.
 *   - 40-person society is size level 2.
 *   - Cat-4 hurricane on session 2 (from all-100) → FES 80, SL 77, mult ×0.8.
 *   - SOP election win, 28 living, $2/citizen + $10/region → treasury $96, $32 per head.
 */

// ---- Level tables (index 0 = level 1 … index 4 = level 5) --------------------
export const LV = {
  pop:      [40, 60, 80, 100, 120],   // POP/SOP starting income
  br:       [10, 15, 20, 25, 30],     // BASIN/RETSIN head income (session 1)
  other:    [30, 45, 60, 75, 90],     // EMPIN/HUMSERV/MASMED/JUDCO base (session 1)
  assets:   [100, 150, 200, 250, 300],// industry starting assets
  cost:     [40, 60, 80, 100, 120],   // passage/anagram purchase cost
  basinPay: [50, 75, 100, 125, 150],  // BASIN pay per passage
  basinErr: [4, 6, 8, 10, 12],        // BASIN deduction per error
  retsinWd: [12, 18, 24, 30, 36],     // RETSIN pay per correct word
};

export const REGIONS = ["Red", "Yellow", "Blue", "Green"];
export const HEADROLES = ["BASIN", "RETSIN", "POP", "SOP", "EMPIN", "HUMSERV", "MASMED", "JUDCO"];

// Coordinator's Manual: region placement of group heads (standard game, 26+ players).
// Red deliberately gets no heads (the deprived region).
export const HEADREGION = {
  BASIN: "Green", JUDCO: "Green", POP: "Green",
  RETSIN: "Yellow", SOP: "Yellow", HUMSERV: "Yellow",
  MASMED: "Blue", EMPIN: "Blue",
};

// SOP = socialist program → funds to social groups; POP = industry program → funds to industry.
export const ELECTION_RECIPIENTS = { SOP: ["SOP", "HUMSERV", "EMPIN"], POP: ["POP", "BASIN", "RETSIN"] };

// ---- Core lookup functions ---------------------------------------------------
export function sizeLevel(pop) {
  return pop > 75 ? 5 : pop > 60 ? 4 : pop > 47 ? 3 : pop > 32 ? 2 : 1;
}

export function incomeMult(min) {
  if (min > 120) return 1.2;
  if (min > 89) return 1;
  if (min > 79) return 0.9;
  if (min > 69) return 0.8;
  if (min > 59) return 0.7;
  if (min > 49) return 0.6;
  if (min > 39) return 0.5;
  if (min > 29) return 0.4;
  if (min > 19) return 0.3;
  if (min > 9) return 0.2;
  if (min >= 0) return 0.1;
  return null; // below zero → society collapses
}

export function riotEffect(pct) {
  if (pct > 0.29) return -30;
  if (pct > 0.24) return -20;
  if (pct > 0.19) return -12;
  if (pct > 0.14) return -6;
  if (pct > 0) return -2;
  return 0;
}

export function basinPayment(passages, errors, level) {
  if (passages <= 0) return 0;
  if (errors > 6) return 0; // too many errors → no payment
  return passages * LV.basinPay[level - 1] - errors * LV.basinErr[level - 1];
}

export function retsinPayment(anagramsIn, words, level) {
  const cap = 5 * Math.max(anagramsIn, words ? 1 : 0);
  return Math.min(words, cap) * LV.retsinWd[level - 1];
}

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Election treasury: levy per living citizen + flat per region, distributed to the
 * winning coalition's three heads. `regionLiving` = [Red, Yellow, Blue, Green] counts.
 */
export function electionTreasury(election, regionLiving) {
  const rows = REGIONS.map((region, i) => {
    const members = regionLiving[i] || 0;
    return {
      region,
      members,
      amount: members > 0 ? members * (election.levyPerMember || 0) + (election.levyFlat || 0) : 0,
    };
  });
  const total = rows.reduce((a, b) => a + b.amount, 0);
  const recips = ELECTION_RECIPIENTS[election.winner] || [];
  const share = recips.length ? round1(total / recips.length) : 0;
  return { rows, total, recips, share };
}

/**
 * Compute one round.
 *
 * @param {object} ctx
 *   round        {number}  1-based session number
 *   level        {number}  1..5 (locked size level for the game)
 *   pop          {number}  living population this round
 *   prev         {FES,SL,SC,PC} previous round's indicators (use 100s for round 1)
 *   counts       { absentees, unemployed, deaths } from the roster this round
 *   inputs       all the session inputs (see defaultInputs)
 *   regionLiving [Red,Yellow,Blue,Green] living counts (for election levy)
 * @returns results object: { indicators, minInd, mult, basinPay, retsinPay,
 *          basinNet, retsinNet, basic, net, disaster, election, level, pop, ...counts }
 */
export function computeRound(ctx) {
  const { round, level, pop: rawPop, prev, counts, inputs, regionLiving } = ctx;
  const pop = Math.max(1, rawPop);
  const I = withDefaults(inputs);
  const D = I.dis, E = I.elec;
  const { absentees, unemployed, deaths } = counts;

  // --- National Indicators ---
  let ind;
  if (round === 1) {
    ind = { FES: 100, SL: 100, SC: 100, PC: 100 };
  } else {
    const rEff = riotEffect(I.rioters / pop);
    const raw = {
      FES: 0.9 * prev.FES + 0.4 * I.invRC - 2 * I.basinPassages + D.dFES + E.dFES,
      SL:  0.9 * prev.SL + 0.1 * I.invRC + 0.1 * I.invWelfare + I.basinPassages + I.retsinAnagramsIn
           - 2 * absentees - 3 * unemployed - 5 * deaths + D.dSL - D.subForfeit + E.dSL,
      SC:  0.9 * prev.SC + 0.2 * I.invWelfare - 3 * unemployed + rEff
           - 5 * I.guardPosts - 3 * I.arrests - 5 * deaths + D.dSC + E.dSC,
      PC:  0.9 * prev.PC + 0.2 * I.invWelfare - I.retsinAnagramsIn - 2 * absentees - 1 * unemployed
           + rEff - 3 * I.arrests - 5 * deaths + 0.25 * I.goalsPos - I.goalsNeg + D.dPC + E.dPC,
    };
    ind = {};
    for (const k of ["FES", "SL", "SC", "PC"]) {
      // −30 floor: no indicator may fall more than 30 below its previous value.
      ind[k] = round1(Math.max(raw[k], prev[k] - 30));
    }
  }
  const minInd = Math.min(ind.FES, ind.SL, ind.SC, ind.PC);
  const mult = incomeMult(minInd);

  // --- Work payments ---
  const basinPay = basinPayment(I.basinPassages, I.basinErrors, level);
  const retsinPay = retsinPayment(I.retsinAnagramsIn, I.retsinWords, level);

  // --- Industry assets ---
  const basinStart = I.basinAssets ?? LV.assets[level - 1];
  const retsinStart = I.retsinAssets ?? LV.assets[level - 1];
  const basinNet = basinStart - I.basinWithdrawn + basinPay;
  const retsinNet = retsinStart - I.retsinWithdrawn + retsinPay;

  // --- Next-session incomes (basic × multiplier) ---
  const startInc = LV.pop[level - 1];
  const basic = {
    BASIN: 0.1 * basinNet,
    RETSIN: 0.1 * retsinNet,
    POP: (I.scPOP * startInc / pop) * 2.5,
    SOP: (I.scSOP * startInc / pop) * 2.5,
    EMPIN: I.scEMPIN * 2,
    HUMSERV: I.scHUMSERV * 2,
    MASMED: I.scMASMED * 2,
    JUDCO: 0.75 * startInc,
  };
  const net = {};
  for (const k in basic) net[k] = mult === null ? 0 : round1(basic[k] * mult);

  return {
    level, pop, absentees, unemployed, deaths,
    rioters: I.rioters, guardPosts: I.guardPosts, arrests: I.arrests,
    indicators: ind, minInd, mult,
    basinPay, retsinPay, basinNet, retsinNet,
    basic, net, nextRound: round + 1,
    disaster: disasterActive(D) ? D : null,
    election: electionActive(E) ? { ...E, treasury: electionTreasury(E, regionLiving) } : null,
  };
}

// ---- Input shape helpers -----------------------------------------------------
export function defaultInputs() {
  return {
    basinAssets: null, basinWithdrawn: 0, basinPassages: 0, basinErrors: 0,
    retsinAssets: null, retsinWithdrawn: 0, retsinAnagramsIn: 0, retsinWords: 0,
    invRC: 0, invWelfare: 0,
    scPOP: 0, scSOP: 0, scEMPIN: 0, scHUMSERV: 0, scMASMED: 0,
    rioters: 0, guardPosts: 0, arrests: 0, goalsPos: 0, goalsNeg: 0,
    dis: defaultDisaster(),
    elec: defaultElection(),
  };
}
export function defaultDisaster() {
  return { title: "", dFES: 0, dSL: 0, dSC: 0, dPC: 0, subForfeit: 0, levy: 0, closures: "", rules: "" };
}
export function defaultElection() {
  return { announce: false, winner: "", levyPerMember: 0, levyFlat: 0, dFES: 0, dSL: 0, dSC: 0, dPC: 0, notes: "" };
}
function withDefaults(inputs) {
  const base = defaultInputs();
  return { ...base, ...inputs, dis: { ...base.dis, ...(inputs?.dis || {}) }, elec: { ...base.elec, ...(inputs?.elec || {}) } };
}
function disasterActive(D) {
  return !!(D.title || D.dFES || D.dSL || D.dSC || D.dPC || D.subForfeit || D.levy || D.closures || D.rules);
}
function electionActive(E) {
  return !!(E.announce || E.winner || E.levyPerMember || E.levyFlat || E.dFES || E.dSL || E.dSC || E.dPC || E.notes);
}

// ---- Minimal self-test (run: `node simsoc-engine.js`) ------------------------
if (typeof process !== "undefined" && process.argv[1] && process.argv[1].endsWith("simsoc-engine.js")) {
  const assert = (label, got, want) =>
    console.log((JSON.stringify(got) === JSON.stringify(want) ? "PASS " : "FAIL ") + label + "  got=" + JSON.stringify(got));

  assert("sizeLevel(40)", sizeLevel(40), 2);
  assert("incomeMult(70)", incomeMult(70), 0.8);
  assert("incomeMult(68)", incomeMult(68), 0.7);
  assert("basinPayment(2,3,1)", basinPayment(2, 3, 1), 88);

  const s1 = computeRound({ round: 1, level: 1, pop: 28, prev: { FES: 100, SL: 100, SC: 100, PC: 100 },
    counts: { absentees: 0, unemployed: 0, deaths: 0 }, inputs: defaultInputs(), regionLiving: [7, 7, 7, 7] });
  assert("S1 indicators", s1.indicators, { FES: 100, SL: 100, SC: 100, PC: 100 });

  const hur = { ...defaultInputs(), dis: { ...defaultDisaster(), dFES: -10, dSL: -5, subForfeit: 8 } };
  const s2 = computeRound({ round: 2, level: 1, pop: 28, prev: { FES: 100, SL: 100, SC: 100, PC: 100 },
    counts: { absentees: 0, unemployed: 0, deaths: 0 }, inputs: hur, regionLiving: [7, 7, 7, 7] });
  assert("Hurricane FES", s2.indicators.FES, 80);
  assert("Hurricane SL", s2.indicators.SL, 77);
  assert("Hurricane mult", s2.mult, 0.8);

  const t = electionTreasury({ winner: "SOP", levyPerMember: 2, levyFlat: 10 }, [7, 7, 7, 7]);
  assert("SOP treasury total", t.total, 96);
  assert("SOP per-head share", t.share, 32);
}
