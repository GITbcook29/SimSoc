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

// BASIN pays the passage purchase cost (LV.cost) per passage purchased, per the
// Coordinator's Manual. Flip to false to revert to the old behavior (assets move
// as start − withdrawn + payment, no purchase deduction) if a coordinator prefers
// to handle purchase costs by hand.
export const BASIN_CHARGE_FOR_PASSAGE_PURCHASES = true;

// Fixed dollar amounts per bank-fee count entered on the Session tab's
// Treasury & Circulation panel. Guard-post fees reuse the existing
// `guardPosts` tally rather than a separate count.
export const BANK_FEES = { ptc: 25, lux: 25, moving: 10, transfer: 3, guardPost: 20 };

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

// Legacy single-total-errors model, used only as a fallback for rounds saved
// before per-passage error entry existed (no `basinPassageErrors` array yet).
export function basinPaymentLegacy(passages, errors, level) {
  if (passages <= 0) return 0;
  if (errors >= 6) return 0; // 6 or more errors ⇒ no payment
  return passages * LV.basinPay[level - 1] - errors * LV.basinErr[level - 1];
}

// Each completed passage is scored independently: 6 or more errors on that
// passage ⇒ no payment for it, otherwise pay − (errors × per-error penalty).
export function basinPaymentPerPassage(errorsArr, level) {
  const pay = LV.basinPay[level - 1];
  const penalty = LV.basinErr[level - 1];
  return errorsArr.reduce((sum, e) => sum + (e >= 6 ? 0 : pay - e * penalty), 0);
}

// How many passages BASIN purchased this round (purchased may exceed completed).
export function basinPurchasedCount(I) {
  return I.basinPurchased ?? I.basinPassages;
}

// How many completed passages are "acceptable" (fewer than 6 errors) — this
// drives the +1 SL per acceptable solution, distinct from passages purchased.
export function basinAcceptablePassages(I) {
  if (I.basinPassageErrors && I.basinPassageErrors.length) {
    return I.basinPassageErrors.filter((e) => e < 6).length;
  }
  return I.basinErrors < 6 ? I.basinPassages : 0;
}

// Picks the per-passage model when per-passage errors have been entered,
// otherwise falls back to the legacy single-total model for older rounds.
export function basinPaymentFromInputs(I, level) {
  if (I.basinPassageErrors && I.basinPassageErrors.length) {
    return basinPaymentPerPassage(I.basinPassageErrors, level);
  }
  return basinPaymentLegacy(I.basinPassages, I.basinErrors, level);
}

export function retsinPayment(anagramsIn, words, level) {
  const cap = 5 * Math.max(anagramsIn, words ? 1 : 0);
  return Math.min(words, cap) * LV.retsinWd[level - 1];
}

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Election treasury: levy per living citizen + flat per region, assessed against
 * every region regardless of whether it has group heads (Red has none — a levy it
 * cannot institutionally earn back is the point of the simulation, not a bug).
 * Only the amount actually COLLECTED is redistributed to the winning coalition's
 * heads — a region that cannot pay produces a real shortfall, not silent auto-payment.
 * `regionLiving` = [Red, Yellow, Blue, Green] counts. `election.levyCollected` is a
 * coordinator-entered { Red, Yellow, Blue, Green } map; a region absent from it is
 * treated as fully collected (backward compat with rounds before this field existed).
 */
export function electionTreasury(election, regionLiving) {
  const collectedMap = election.levyCollected || {};
  const inKindMap = election.inKind || {};
  const rows = REGIONS.map((region, i) => {
    const members = regionLiving[i] || 0;
    const assessed = members > 0 ? members * (election.levyPerMember || 0) + (election.levyFlat || 0) : 0;
    const collected = collectedMap[region] != null ? collectedMap[region] : assessed;
    return { region, members, assessed, collected, shortfall: Math.max(0, assessed - collected), inKind: inKindMap[region] || 0 };
  });
  const totalAssessed = rows.reduce((a, b) => a + b.assessed, 0);
  const total = rows.reduce((a, b) => a + b.collected, 0);
  const totalShortfall = rows.reduce((a, b) => a + b.shortfall, 0);
  const recips = ELECTION_RECIPIENTS[election.winner] || [];
  const share = recips.length ? round1(total / recips.length) : 0;
  return { rows, total, totalAssessed, totalShortfall, recips, share };
}

// Disaster levy assessment is a flat per-session $ amount split evenly across
// the four regions (matches the hurricane preset's "$10 to FEMA" per region on
// a $40 total levy). `levyCollected` is a coordinator-entered { Red, Yellow,
// Blue, Green } map; a region absent from it is treated as fully collected.
export function disasterLevyAssessedPerRegion(D) {
  return (D.levy || 0) / REGIONS.length;
}
export function disasterLevyRows(D) {
  const assessed = disasterLevyAssessedPerRegion(D);
  const collectedMap = D.levyCollected || {};
  const inKindMap = D.inKind || {};
  return REGIONS.map((region) => {
    const collected = collectedMap[region] != null ? collectedMap[region] : assessed;
    return { region, assessed, collected, shortfall: Math.max(0, assessed - collected), inKind: inKindMap[region] || 0 };
  });
}
export function disasterLevyCollectedTotal(D) {
  return disasterLevyRows(D).reduce((a, r) => a + r.collected, 0);
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
  const basinPurchased = basinPurchasedCount(I);
  const basinAcceptable = basinAcceptablePassages(I);

  // --- National Indicators ---
  let ind, rawInd, absorbed;
  if (round === 1) {
    ind = { FES: 100, SL: 100, SC: 100, PC: 100 };
    rawInd = { ...ind };
    absorbed = { FES: 0, SL: 0, SC: 0, PC: 0 };
  } else {
    const rEff = riotEffect(I.rioters / pop);
    const rawCalc = {
      FES: 0.9 * prev.FES + 0.4 * I.invRC - 2 * basinPurchased + D.dFES + E.dFES,
      SL:  0.9 * prev.SL + 0.1 * I.invRC + 0.1 * I.invWelfare + basinAcceptable + I.retsinAnagramsIn
           - 2 * absentees - 3 * unemployed - 5 * deaths + D.dSL - D.subForfeit + E.dSL,
      SC:  0.9 * prev.SC + 0.2 * I.invWelfare - 3 * unemployed + rEff
           - 5 * I.guardPosts - 3 * I.arrests - 5 * deaths + D.dSC + E.dSC,
      PC:  0.9 * prev.PC + 0.2 * I.invWelfare - I.retsinAnagramsIn - 2 * absentees - 1 * unemployed
           + rEff - 3 * I.arrests - 5 * deaths + 0.25 * I.goalsPos - I.goalsNeg + D.dPC + E.dPC,
    };
    ind = {};
    rawInd = {};
    absorbed = {};
    for (const k of ["FES", "SL", "SC", "PC"]) {
      // −30 floor: no indicator may fall more than 30 below its previous value.
      const floor = prev[k] - 30;
      const clipped = Math.max(rawCalc[k], floor);
      ind[k] = round1(clipped);
      rawInd[k] = round1(rawCalc[k]);
      absorbed[k] = rawCalc[k] < floor ? round1(floor - rawCalc[k]) : 0;
    }
  }
  const minInd = Math.min(ind.FES, ind.SL, ind.SC, ind.PC);
  const mult = incomeMult(minInd);

  // --- Work payments ---
  const basinPay = basinPaymentFromInputs(I, level);
  const retsinPay = retsinPayment(I.retsinAnagramsIn, I.retsinWords, level);

  // --- Industry assets ---
  const basinStart = I.basinAssets ?? LV.assets[level - 1];
  const retsinStart = I.retsinAssets ?? LV.assets[level - 1];
  const basinPassageCost = BASIN_CHARGE_FOR_PASSAGE_PURCHASES ? basinPurchased * LV.cost[level - 1] : 0;
  const basinNet = basinStart - I.basinWithdrawn - basinPassageCost + basinPay;
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
    indicators: ind, raw: rawInd, absorbed, minInd, mult,
    basinPay, retsinPay, basinNet, retsinNet, basinPassageCost,
    basic, net, nextRound: round + 1,
    disaster: disasterActive(D) ? D : null,
    election: electionActive(E) ? { ...E, treasury: electionTreasury(E, regionLiving) } : null,
  };
}

// Session-1 starting payments to each group head, from the Coordinator's Manual
// size-level table. This is the entire money supply at the start of the game.
export function startingPayments(level) {
  return {
    BASIN: LV.br[level - 1],
    RETSIN: LV.br[level - 1],
    POP: LV.pop[level - 1],
    SOP: LV.pop[level - 1],
    EMPIN: LV.other[level - 1],
    HUMSERV: LV.other[level - 1],
    MASMED: LV.other[level - 1],
    JUDCO: round1(0.75 * LV.pop[level - 1]),
  };
}

// The manual gives starting income to group HEADS only — ordinary members begin
// with nothing and must be employed or given money. Red therefore starts at $0:
// that is the deprived region's structural disadvantage, not a missing figure.
// If a coordinator runs a variant that hands every participant a starting
// allotment, set this to that per-person amount and it flows into each region's
// opening cash and into the issued total.
export const MEMBER_STARTING_ALLOWANCE = 0;

// ---- Money in circulation -----------------------------------------------------
// Bank = infinite source/sink, untracked. Group treasuries + region holdings are
// what's "in circulation". Election levies are collected-from-and-redistributed-to
// the population, so they are explicitly NOT counted as a removal/injection here —
// only the disaster (FEMA) levy actually leaves circulation.
//
// `round` / `prevRound` are Round rows ({ inputs, results, closed }); `prevRound`
// may be undefined (round 1). Returns this round's OWN issued/removed money, not
// a cumulative total — see computeCirculation for the running total across rounds.
export function roundFlow(round, prevRound, level) {
  const I = withDefaults(round.inputs);
  let issued = 0;
  let removed = 0;

  // Distributed group income is computed at the close of the PRIOR round and
  // credited at the start of this one.
  if (prevRound && prevRound.closed && prevRound.results) {
    for (const g of HEADROLES) issued += prevRound.results.net[g] || 0;
  }
  // BASIN/RETSIN withdrawals happen during this round.
  issued += (I.basinWithdrawn || 0) + (I.retsinWithdrawn || 0);
  issued += (I.circulation.injections || []).reduce((a, x) => a + (x.amount || 0), 0);

  const isClosed = round.closed && !!round.results;
  const purchased = basinPurchasedCount(I);
  const passageCost = isClosed
    ? round.results.basinPassageCost || 0
    : BASIN_CHARGE_FOR_PASSAGE_PURCHASES
    ? purchased * LV.cost[level - 1]
    : 0;
  removed += passageCost;

  const fees = I.circulation.bankFees;
  removed +=
    (fees.ptc || 0) * BANK_FEES.ptc +
    (fees.lux || 0) * BANK_FEES.lux +
    (fees.moving || 0) * BANK_FEES.moving +
    (fees.transfer || 0) * BANK_FEES.transfer +
    (I.guardPosts || 0) * BANK_FEES.guardPost;

  removed += disasterLevyCollectedTotal(I.dis);
  removed += (I.circulation.removals || []).reduce((a, x) => a + (x.amount || 0), 0);

  return { issued, removed };
}

/**
 * Running money-in-circulation snapshot as of `currentRound`. Iterates every
 * round from 1 through currentRound, since group treasuries are derived
 * (opening balance + income received − recorded spending) rather than stored.
 *
 * `rounds` is a { [round_no]: Round } map (as held in GameProvider state).
 */
export function computeCirculation({ rounds, currentRound, level, regionLiving = [0, 0, 0, 0] }) {
  const opening = startingPayments(level);
  const groupDerived = { ...opening };
  const memberOpening = regionLiving.reduce((a, n) => a + (n || 0), 0) * MEMBER_STARTING_ALLOWANCE;
  let issuedTotal = Object.values(opening).reduce((a, b) => a + b, 0) + memberOpening;
  let removedTotal = 0;

  const roundNos = Object.keys(rounds)
    .map(Number)
    .filter((r) => r <= currentRound)
    .sort((a, b) => a - b);

  for (const r of roundNos) {
    const round = rounds[r];
    const prevRound = rounds[r - 1];
    const { issued, removed } = roundFlow(round, prevRound, level);
    issuedTotal += issued;
    removedTotal += removed;

    if (prevRound && prevRound.closed && prevRound.results) {
      for (const g of HEADROLES) groupDerived[g] += prevRound.results.net[g] || 0;
    }
    const I = withDefaults(round.inputs);
    groupDerived.BASIN += I.basinWithdrawn || 0;
    groupDerived.RETSIN += I.retsinWithdrawn || 0;

    // Money moved from a head's cash back into the bank-tracked asset pool
    // (entering a higher "Assets (start of round)" than what carried forward).
    const carriedBasin = r === 1 ? LV.assets[level - 1] : prevRound?.results?.basinNet ?? LV.assets[level - 1];
    const carriedRetsin = r === 1 ? LV.assets[level - 1] : prevRound?.results?.retsinNet ?? LV.assets[level - 1];
    const enteredBasin = I.basinAssets ?? carriedBasin;
    const enteredRetsin = I.retsinAssets ?? carriedRetsin;
    removedTotal += Math.max(0, enteredBasin - carriedBasin) + Math.max(0, enteredRetsin - carriedRetsin);
  }

  const curInputs = withDefaults(rounds[currentRound]?.inputs || {});
  const regionCashOverride = curInputs.circulation.regionCash || {};
  const groupCashOverride = curInputs.circulation.groupCash || {};
  const groupTreasury = {};
  for (const g of HEADROLES) groupTreasury[g] = groupCashOverride[g] != null ? groupCashOverride[g] : groupDerived[g];

  // A region holds the money of everyone living in it — including the group
  // heads placed there by the manual (Red has none, so it opens at $0). Regions
  // are therefore the authoritative total; group treasuries are a cross-cutting
  // view of the slice the heads hold, NOT a second pot to add on top. Adding
  // both would double-count the entire supply.
  const regionDerived = { Red: 0, Yellow: 0, Blue: 0, Green: 0 };
  for (const g of HEADROLES) regionDerived[HEADREGION[g]] += groupTreasury[g];
  REGIONS.forEach((r, i) => {
    regionDerived[r] = round1(regionDerived[r] + (regionLiving[i] || 0) * MEMBER_STARTING_ALLOWANCE);
  });

  const regionCash = {};
  for (const r of REGIONS) regionCash[r] = regionCashOverride[r] != null ? regionCashOverride[r] : regionDerived[r];

  const totalRegion = round1(Object.values(regionCash).reduce((a, b) => a + b, 0));
  const totalGroup = round1(Object.values(groupTreasury).reduce((a, b) => a + b, 0));
  const total = totalRegion;
  const totalMembers = round1(total - totalGroup);
  const flowTotal = round1(issuedTotal - removedTotal);

  return {
    level,
    round: currentRound,
    regionCash,
    regionDerived,
    regionCashOverride,
    groupDerived,
    groupCashOverride,
    groupTreasury,
    totalRegion,
    totalGroup,
    totalMembers,
    total,
    issuedTotal,
    removedTotal,
    flowTotal,
    variance: round1(total - flowTotal),
  };
}

// ---- Input shape helpers -----------------------------------------------------
export function defaultInputs() {
  return {
    basinAssets: null, basinWithdrawn: 0, basinPurchased: null, basinPassages: 0, basinErrors: 0, basinPassageErrors: [],
    retsinAssets: null, retsinWithdrawn: 0, retsinAnagramsIn: 0, retsinWords: 0,
    invRC: 0, invWelfare: 0,
    scPOP: 0, scSOP: 0, scEMPIN: 0, scHUMSERV: 0, scMASMED: 0,
    rioters: 0, guardPosts: 0, arrests: 0, goalsPos: 0, goalsNeg: 0,
    dis: defaultDisaster(),
    elec: defaultElection(),
    circulation: defaultCirculation(),
  };
}
export function defaultDisaster() {
  return { title: "", dFES: 0, dSL: 0, dSC: 0, dPC: 0, subForfeit: 0, levy: 0, levyCollected: {}, inKind: {}, closures: "", rules: "" };
}
export function defaultElection() {
  return {
    announce: false, winner: "", levyPerMember: 0, levyFlat: 0, levyCollected: {}, inKind: {},
    dFES: 0, dSL: 0, dSC: 0, dPC: 0, notes: "",
  };
}
export function defaultCirculation() {
  return {
    // Left empty rather than zeroed so "not yet counted" stays distinguishable
    // from a counted zero: an absent region falls back to its derived opening
    // cash (the heads living there), which is what makes Session 1 self-seed.
    regionCash: {},
    groupCash: {},
    bankFees: { ptc: 0, lux: 0, moving: 0, transfer: 0 },
    removals: [],
    injections: [],
  };
}
function withDefaults(inputs) {
  const base = defaultInputs();
  return {
    ...base,
    ...inputs,
    dis: { ...base.dis, ...(inputs?.dis || {}) },
    elec: { ...base.elec, ...(inputs?.elec || {}) },
    circulation: {
      ...base.circulation,
      ...(inputs?.circulation || {}),
      regionCash: { ...base.circulation.regionCash, ...(inputs?.circulation?.regionCash || {}) },
      bankFees: { ...base.circulation.bankFees, ...(inputs?.circulation?.bankFees || {}) },
    },
  };
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
  assert("basinPaymentLegacy(2,3,1)", basinPaymentLegacy(2, 3, 1), 88);
  assert("basinPaymentPerPassage([1,6],1)", basinPaymentPerPassage([1, 6], 1), 46);
  assert("basinAcceptablePassages([1,6])", basinAcceptablePassages({ basinPassageErrors: [1, 6] }), 1);
  assert("basinPurchasedCount fallback", basinPurchasedCount({ basinPurchased: null, basinPassages: 2 }), 2);

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

  // 3 purchased / 2 completed, errors [1, 6], level 1: one passage paid, one
  // zeroed; FES −2×purchased; SL +1×acceptable (not +2); purchase cost deducted.
  const basinIn = {
    ...defaultInputs(),
    basinAssets: 100,
    basinWithdrawn: 0,
    basinPurchased: 3,
    basinPassages: 2,
    basinPassageErrors: [1, 6],
  };
  const s3 = computeRound({ round: 2, level: 1, pop: 28, prev: { FES: 100, SL: 100, SC: 100, PC: 100 },
    counts: { absentees: 0, unemployed: 0, deaths: 0 }, inputs: basinIn, regionLiving: [7, 7, 7, 7] });
  assert("BASIN example payment", s3.basinPay, 46);
  assert("BASIN example FES", s3.indicators.FES, round1(90 - 6));
  assert("BASIN example SL", s3.indicators.SL, round1(90 + 1));
  assert("BASIN example passage cost", s3.basinPassageCost, 120);
  assert("BASIN example net", s3.basinNet, 100 - 0 - 120 + 46);

  // --- Money in circulation ---
  // Round 1: no prior round, so issuedTotal is just the 8 starting payments,
  // removedTotal is 0 (nothing purchased/collected/fee'd yet).
  const round1Row = { id: "r1", game_id: "g", round_no: 1, inputs: defaultInputs(), results: null, closed: false };
  const c1 = computeCirculation({ rounds: { 1: round1Row }, currentRound: 1, level: 1 });
  const expectedStart = 10 + 10 + 40 + 40 + 30 + 30 + 30 + 30; // BASIN RETSIN POP SOP EMPIN HUMSERV MASMED JUDCO(0.75*40)
  assert("circulation round1 issuedTotal = starting payments", c1.issuedTotal, expectedStart);
  assert("circulation round1 removedTotal", c1.removedTotal, 0);

  // Session 1 self-seeds: with nothing counted, the money supply is exactly the
  // manual's starting payments, and the region view and group view are two
  // lenses on the SAME $220 — never added together (that would double-count).
  assert("session 1 total = manual starting payments", c1.total, 220);
  assert("session 1 region view sums to the same total", c1.totalRegion, c1.totalGroup);
  assert("session 1 no member money yet", c1.totalMembers, 0);
  assert("session 1 variance is zero", c1.variance, 0);
  // Heads are placed Green: BASIN+JUDCO+POP, Yellow: RETSIN+SOP+HUMSERV,
  // Blue: MASMED+EMPIN, Red: none.
  assert("Green opens at 10+30+40", c1.regionCash.Green, 80);
  assert("Yellow opens at 10+40+30", c1.regionCash.Yellow, 80);
  assert("Blue opens at 30+30", c1.regionCash.Blue, 60);
  assert("Red opens at 0 (no group heads)", c1.regionCash.Red, 0);

  // Close round 1 with a real payments table, open round 2, and verify:
  // (a) round 2's issued jumps by exactly the round-1 payments total,
  // (b) a FEMA levy collected in round 2 lowers circulation by exactly that
  //     amount, (c) an election levy leaves the total unchanged (redistribution
  //     within circulation, not a removal).
  const closedRound1Results = computeRound({
    round: 1, level: 1, pop: 28, prev: { FES: 100, SL: 100, SC: 100, PC: 100 },
    counts: { absentees: 0, unemployed: 0, deaths: 0 }, inputs: defaultInputs(), regionLiving: [7, 7, 7, 7],
  });
  const closedRound1 = { id: "r1", game_id: "g", round_no: 1, inputs: defaultInputs(), results: closedRound1Results, closed: true };
  const payoutTotal = Object.values(closedRound1Results.net).reduce((a, b) => a + b, 0);

  const round2Inputs = { ...defaultInputs(), dis: { ...defaultDisaster(), levy: 40, levyCollected: { Red: 10, Yellow: 10, Blue: 10, Green: 10 } } };
  const round2 = { id: "r2", game_id: "g", round_no: 2, inputs: round2Inputs, results: null, closed: false };
  const c2 = computeCirculation({ rounds: { 1: closedRound1, 2: round2 }, currentRound: 2, level: 1 });
  assert("circulation round2 issued = round1 payouts", c2.issuedTotal - c1.issuedTotal, round1(payoutTotal));
  assert("FEMA levy removes exactly the collected amount", c2.removedTotal, 40);

  const round2WithElection = {
    ...round2Inputs,
    elec: { ...defaultElection(), winner: "SOP", levyPerMember: 2, levyFlat: 10, levyCollected: { Red: 26, Yellow: 24, Blue: 24, Green: 24 } },
  };
  const round2b = { ...round2, inputs: round2WithElection };
  const c2b = computeCirculation({ rounds: { 1: closedRound1, 2: round2b }, currentRound: 2, level: 1 });
  assert("election levy does not change circulation removedTotal", c2b.removedTotal, c2.removedTotal);

  // Election levy shortfall: Red (0 heads) can't pay its $26 assessment
  // (8 living members * $2 + $10 flat, per the Coordinator's Manual example).
  const shortfall = electionTreasury({ winner: "SOP", levyPerMember: 2, levyFlat: 10, levyCollected: { Red: 8 } }, [8, 8, 8, 8]);
  assert("Red assessed $26", shortfall.rows[0].assessed, 26);
  assert("Red shortfall $18", shortfall.rows[0].shortfall, 18);
  assert("collected total reflects shortfall", shortfall.total, 8 + 26 + 26 + 26);

  // Floor disclosure: a heavy round (hurricane + riots/arrests/posts/death)
  // from prev={FES:65,SL:60,SC:65,SC:60}-ish should clip and report absorbed>0.
  const heavy = {
    ...defaultInputs(),
    rioters: 8, arrests: 3, guardPosts: 2,
    dis: { ...defaultDisaster(), dFES: -10, dSL: -5, subForfeit: 8 },
  };
  const s4 = computeRound({
    round: 2, level: 1, pop: 20, prev: { FES: 65, SL: 60, SC: 65, PC: 60 },
    counts: { absentees: 0, unemployed: 0, deaths: 1 }, inputs: heavy, regionLiving: [5, 5, 5, 5],
  });
  assert("heavy round SC clipped", s4.absorbed.SC > 0, true);
  assert("heavy round PC clipped", s4.absorbed.PC > 0, true);
  assert("heavy round raw below clipped for SC", s4.raw.SC < s4.indicators.SC, true);
}
