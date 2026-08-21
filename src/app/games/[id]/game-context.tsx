"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { makePlayerCode } from "@/lib/player-code";
import {
  computeRound,
  defaultInputs,
  defaultDisaster,
  defaultElection,
  defaultCirculation,
  sizeLevel,
} from "@/lib/simsoc-engine.js";
import {
  currentLevel,
  isDead,
  livingByRegion,
  newDeaths,
  popCount,
  countStatus,
} from "@/lib/derive";
import {
  HEADROLES,
  REGIONS,
  type Game,
  type GameHeads,
  type HeadRole,
  type Indicators,
  type Participant,
  type Region,
  type Round,
  type RoundInputs,
  type Rule,
} from "@/lib/types";

type Toast = { id: number; text: string; kind: "success" | "error" };

type GameContextValue = {
  loading: boolean;
  game: Game;
  participants: Participant[];
  heads: GameHeads;
  rounds: Record<number, Round>;
  currentRound: number;
  rules: Rule[];
  toasts: Toast[];

  // derived
  level: number;
  pop: number;
  prevIndicators: (round: number) => Indicators;

  // mutations
  addParticipant: (name: string, region: Region) => Promise<void>;
  addParticipantsBulk: (
    rows: Partial<Participant>[]
  ) => Promise<{ added: number; headsSet: HeadRole[] }>;
  deleteParticipant: (id: string) => Promise<void>;
  setRegion: (id: string, region: Region) => Promise<void>;
  autoRegions: () => Promise<void>;
  setHead: (role: HeadRole, participantId: string | null) => Promise<void>;
  reconcileHeadRoles: () => Promise<void>;
  setConfig: (patch: Partial<Game["config"]>) => Promise<void>;
  regenerateShareLink: () => Promise<void>;
  startNextSession: () => Promise<void>;
  setStatus: (id: string, code: "P" | "A" | "E" | "D") => Promise<void>;
  setFlag: (id: string, flag: "ns" | "lux" | "ptc") => Promise<void>;
  setInput: <K extends keyof RoundInputs>(key: K, value: RoundInputs[K]) => Promise<void>;
  setDisInput: (key: string, value: string | number | Partial<Record<Region, number>>) => Promise<void>;
  setElecInput: (key: string, value: string | number | boolean | Partial<Record<Region, number>>) => Promise<void>;
  setCirculationInput: (patch: Partial<RoundInputs["circulation"]>) => Promise<void>;
  tally: (key: "rioters" | "guardPosts" | "arrests" | "goalsPos" | "goalsNeg", d: number) => Promise<void>;
  closeSession: (opts?: { force?: boolean }) => Promise<{ ok: boolean; needsConfirm?: number; collapsed?: boolean }>;
  reopenRound: (roundNo: number) => Promise<void>;
  addRule: (text: string) => Promise<void>;
  updateRule: (id: string, text: string) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  toast: (text: string) => void;
};

const GameContext = createContext<GameContextValue | null>(null);

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}

export function GameProvider({
  gameId,
  initialGame,
  children,
}: {
  gameId: string;
  initialGame: Game;
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<Game>(initialGame);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [heads, setHeads] = useState<GameHeads>({});
  const [rounds, setRounds] = useState<Record<number, Round>>({});
  const [rules, setRules] = useState<Rule[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Mirrors `rounds` for synchronous reads. Reading state back out of a `setState`
  // updater's closure isn't reliably synchronous in React, which caused a real bug:
  // rapid sequential writes (e.g. applying a disaster preset) would intermittently
  // read a not-yet-populated value and silently skip the Supabase write. The ref is
  // always current the instant `setRounds` is called, so callers building the next
  // patch (setDisInput, setElecInput, tally, updateRoundInputs) read from here.
  const roundsRef = useRef(rounds);
  useEffect(() => {
    roundsRef.current = rounds;
  }, [rounds]);

  // Serializes writes to `rounds` so rapid consecutive edits (e.g. clicking a tally
  // +/- button several times fast) always reach Supabase in the order they were
  // made, instead of racing as independent unawaited requests where the last one
  // to arrive — not the last one sent — wins.
  const roundWriteQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  // Same rationale as roundsRef: patchParticipantSession needs to read the
  // just-computed per-participant sessions patch synchronously to send to Supabase,
  // and reading it back out of a setParticipants updater's closure isn't reliably
  // synchronous — that silently sent `sessions: {}` (wiping the row) for any
  // participant whose update didn't win the race, which in practice meant only the
  // first roster row's attendance clicks ever persisted.
  const participantsRef = useRef(participants);
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  // Serializes writes per participant id so rapid clicks on the same row's status
  // buttons land in order.
  const participantWriteQueueRef = useRef<Map<string, Promise<unknown>>>(new Map());

  // Same rationale as roundsRef: addRule derives the new row's sort_order from the
  // current list, and two quick "Add rule" presses would otherwise both read the
  // pre-render value and land on the same sort_order.
  const rulesRef = useRef(rules);
  useEffect(() => {
    rulesRef.current = rules;
  }, [rules]);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    const kind: Toast["kind"] = text.startsWith("Error") ? "error" : "success";
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
  }, []);

  const fetchAll = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      const [{ data: g }, { data: parts }, { data: headRows }, { data: roundRows }, { data: ruleRows }] =
        await Promise.all([
          supabase.from("games").select("*").eq("id", gameId).single(),
          supabase.from("participants").select("*").eq("game_id", gameId).order("name"),
          supabase.from("game_heads").select("*").eq("game_id", gameId),
          supabase.from("rounds").select("*").eq("game_id", gameId).order("round_no"),
          supabase
            .from("rules")
            .select("*")
            .eq("game_id", gameId)
            .order("sort_order")
            .order("created_at"),
        ]);

      if (g) setGame(g as Game);
      setParticipants((parts ?? []) as Participant[]);
      setRules((ruleRows ?? []) as Rule[]);

      const headMap: GameHeads = {};
      for (const h of headRows ?? []) headMap[h.role as HeadRole] = h.participant_id;
      setHeads(headMap);

      const roundMap: Record<number, Round> = {};
      for (const r of roundRows ?? []) roundMap[r.round_no] = r as Round;

      // Ensure round 1 always exists.
      if (!roundMap[1]) {
        const id = crypto.randomUUID();
        const newRound: Round = {
          id,
          game_id: gameId,
          round_no: 1,
          inputs: defaultInputs(),
          results: null,
          closed: false,
        };
        await supabase.from("rounds").insert({
          id,
          game_id: gameId,
          round_no: 1,
          inputs: newRound.inputs,
          results: null,
          closed: false,
        });
        roundMap[1] = newRound;
      }
      roundsRef.current = roundMap;
      setRounds(roundMap);
      if (!opts?.silent) setLoading(false);
    },
    [gameId, supabase]
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime: any change to this game's rows (from another coordinator's tab, or
  // this one) triggers a silent refetch so everyone stays in sync without a manual
  // reload. Debounced since closing a session touches multiple tables at once.
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchAll({ silent: true }), 400);
    };

    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `game_id=eq.${gameId}` },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_heads", filter: `game_id=eq.${gameId}` },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds", filter: `game_id=eq.${gameId}` },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rules", filter: `game_id=eq.${gameId}` },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [gameId, supabase, fetchAll]);

  const currentRound = game.current_round;
  const level = currentLevel(
    participants,
    currentRound,
    game.config.lockLevel,
    game.config.lockedLevel
  );
  const pop = popCount(participants, currentRound);

  const prevIndicators = useCallback(
    (round: number): Indicators => {
      if (round <= 1) return { FES: 100, SL: 100, SC: 100, PC: 100 };
      const pr = rounds[round - 1];
      return pr?.closed && pr.results ? pr.results.indicators : { FES: 100, SL: 100, SC: 100, PC: 100 };
    },
    [rounds]
  );

  // ---- participants ----
  const addParticipant = useCallback(
    async (name: string, region: Region) => {
      const id = crypto.randomUUID();
      const row: Participant = {
        id,
        game_id: gameId,
        name,
        region,
        team: null,
        role: null,
        age: null,
        gender: null,
        job: null,
        lux: false,
        ptc: false,
        sessions: {},
      };
      setParticipants((p) => [...p, row]);
      const { error } = await supabase.from("participants").insert(row);
      if (error) toast("Error adding participant: " + error.message);
    },
    [gameId, supabase, toast]
  );

  const addParticipantsBulk = useCallback(
    async (rows: Partial<Participant>[]) => {
      const toInsert: Participant[] = rows.map((r, i) => ({
        id: crypto.randomUUID(),
        game_id: gameId,
        name: r.name ?? "",
        region: r.region ?? REGIONS[(participants.length + i) % 4],
        team: r.team ?? null,
        role: r.role ?? null,
        age: r.age ?? null,
        gender: r.gender ?? null,
        job: r.job ?? null,
        lux: false,
        ptc: false,
        sessions: {},
      }));
      setParticipants((p) => [...p, ...toInsert]);
      const { error } = await supabase.from("participants").insert(toInsert);
      if (error) toast("Error importing: " + error.message);

      const headsSet: HeadRole[] = [];
      const newHeads = { ...heads };
      for (const p of toInsert) {
        const roleKey = HEADROLES.find(
          (h) => h.toLowerCase() === (p.role ?? "").toLowerCase().replace(/\s*head$/, "").trim()
        );
        if (roleKey && !newHeads[roleKey]) {
          newHeads[roleKey] = p.id;
          headsSet.push(roleKey);
        }
      }
      if (headsSet.length) {
        setHeads(newHeads);
        await supabase
          .from("game_heads")
          .upsert(headsSet.map((role) => ({ game_id: gameId, role, participant_id: newHeads[role] })));
      }
      return { added: toInsert.length, headsSet };
    },
    [gameId, heads, participants.length, supabase, toast]
  );

  const deleteParticipant = useCallback(
    async (id: string) => {
      setParticipants((p) => p.filter((x) => x.id !== id));
      const { error } = await supabase.from("participants").delete().eq("id", id);
      if (error) toast("Error deleting: " + error.message);
    },
    [supabase, toast]
  );

  const setRegion = useCallback(
    async (id: string, region: Region) => {
      setParticipants((p) => p.map((x) => (x.id === id ? { ...x, region } : x)));
      const { error } = await supabase.from("participants").update({ region }).eq("id", id);
      if (error) toast("Error: " + error.message);
    },
    [supabase, toast]
  );

  const autoRegions = useCallback(async () => {
    const updated = participants.map((p, i) => ({ ...p, region: REGIONS[i % 4] }));
    setParticipants(updated);
    for (const p of updated) {
      await supabase.from("participants").update({ region: p.region }).eq("id", p.id);
    }
  }, [participants, supabase]);

  // Keeps game_heads and participants.role in sync: reassigning a group head
  // clears the outgoing head's role and stamps the incoming head's role, so the
  // roster's Role column reflects the change immediately without a reload.
  const setHead = useCallback(
    async (role: HeadRole, participantId: string | null) => {
      const outgoingId = heads[role] ?? null;
      setHeads((h) => ({ ...h, [role]: participantId }));
      setParticipants((ps) =>
        ps.map((p) => {
          if (outgoingId && p.id === outgoingId && p.id !== participantId) return { ...p, role: null };
          if (participantId && p.id === participantId) return { ...p, role };
          return p;
        })
      );

      if (outgoingId && outgoingId !== participantId) {
        const { error } = await supabase.from("participants").update({ role: null }).eq("id", outgoingId);
        if (error) toast("Error: " + error.message);
      }
      if (participantId) {
        const { error } = await supabase.from("participants").update({ role }).eq("id", participantId);
        if (error) toast("Error: " + error.message);
      }
      const { error } = await supabase
        .from("game_heads")
        .upsert({ game_id: gameId, role, participant_id: participantId });
      if (error) toast("Error: " + error.message);
    },
    [gameId, heads, supabase, toast]
  );

  // Idempotent data repair for games where game_heads and participants.role
  // already drifted apart before this sync existed. game_heads is treated as
  // authoritative. Safe to call repeatedly — a no-op once everything matches.
  const reconcileHeadRoles = useCallback(async () => {
    const headSet = new Set<string>(HEADROLES);
    const correctRoleFor = new Map<string, HeadRole>();
    for (const role of HEADROLES) {
      const pid = heads[role];
      if (pid) correctRoleFor.set(pid, role);
    }
    const changes: { id: string; name: string; from: string | null; to: HeadRole | null }[] = [];
    for (const p of participants) {
      const correct = correctRoleFor.get(p.id) ?? null;
      const looksLikeHead = !!p.role && headSet.has(p.role);
      if (correct !== null) {
        if (p.role !== correct) changes.push({ id: p.id, name: p.name, from: p.role, to: correct });
      } else if (looksLikeHead) {
        changes.push({ id: p.id, name: p.name, from: p.role, to: null });
      }
    }
    if (!changes.length) return;
    console.log("[reconcileHeadRoles] correcting participants.role to match game_heads:", changes);
    setParticipants((ps) =>
      ps.map((p) => {
        const c = changes.find((x) => x.id === p.id);
        return c ? { ...p, role: c.to } : p;
      })
    );
    for (const c of changes) {
      const { error } = await supabase.from("participants").update({ role: c.to }).eq("id", c.id);
      if (error) toast("Error reconciling " + c.name + ": " + error.message);
    }
    toast(`Reconciled ${changes.length} participant role(s) to match Group heads`);
  }, [heads, participants, supabase, toast]);

  const setConfig = useCallback(
    async (patch: Partial<Game["config"]>) => {
      const nextConfig = { ...game.config, ...patch };
      if (patch.lockLevel === true && !nextConfig.lockedLevel) {
        nextConfig.lockedLevel = sizeLevel(popCount(participants, currentRound));
      }
      if (patch.lockLevel === false) {
        nextConfig.lockedLevel = null;
      }
      setGame((g) => ({ ...g, config: nextConfig }));
      const { error } = await supabase.from("games").update({ config: nextConfig }).eq("id", gameId);
      if (error) toast("Error: " + error.message);
    },
    [currentRound, game.config, gameId, participants, supabase, toast]
  );

  const regenerateShareLink = useCallback(async () => {
    const token = crypto.randomUUID();
    const code = makePlayerCode();
    setGame((g) => ({ ...g, status_share_token: token, player_code: code }));
    const { error } = await supabase
      .from("games")
      .update({ status_share_token: token, player_code: code })
      .eq("id", gameId);
    if (error) toast("Error: " + error.message);
    else toast("Player link & code regenerated — the old ones no longer work");
  }, [gameId, supabase, toast]);

  // "Start next session": releases every closed-but-unreleased MasMed report to
  // players (in practice the one just closed). Kept separate from closeSession so
  // the report drops when the group actually reconvenes, not the instant the
  // coordinator computes it.
  const startNextSession = useCallback(async () => {
    const closed = Object.values(rounds)
      .filter((r) => r.closed && r.results)
      .map((r) => r.round_no);
    if (!closed.length) return;
    const latestClosed = Math.max(...closed);
    const releasedThrough = game.masmed_released_through ?? 0;
    if (latestClosed <= releasedThrough) return;
    setGame((g) => ({ ...g, masmed_released_through: latestClosed }));
    const { error } = await supabase
      .from("games")
      .update({ masmed_released_through: latestClosed })
      .eq("id", gameId);
    if (error) toast("Error: " + error.message);
    else toast(`Session ${latestClosed} MasMed report released to players`);
  }, [rounds, game.masmed_released_through, gameId, supabase, toast]);

  // ---- session marks ----
  const patchParticipantSession = useCallback(
    async (id: string, round: number, patch: Record<string, unknown>) => {
      const p = participantsRef.current.find((x) => x.id === id);
      if (!p) return;
      const updatedSessions: Participant["sessions"] = {
        ...p.sessions,
        [String(round)]: { ...p.sessions[String(round)], ...patch },
      };

      participantsRef.current = participantsRef.current.map((x) =>
        x.id === id ? { ...x, sessions: updatedSessions } : x
      );
      setParticipants(participantsRef.current);

      const write = async () => {
        const { error } = await supabase
          .from("participants")
          .update({ sessions: updatedSessions })
          .eq("id", id);
        if (error) toast("Error: " + error.message);
      };
      const prev = participantWriteQueueRef.current.get(id) ?? Promise.resolve();
      const next = prev.then(write, write);
      participantWriteQueueRef.current.set(id, next);
      await next;
    },
    [supabase, toast]
  );

  const setStatus = useCallback(
    async (id: string, code: "P" | "A" | "E" | "D") => {
      const p = participants.find((x) => x.id === id);
      if (!p) return;
      const cur = p.sessions[String(currentRound)]?.status;
      if (cur === code) return; // clicking the already-selected status is a no-op
      await patchParticipantSession(id, currentRound, { status: code });
    },
    [currentRound, participants, patchParticipantSession]
  );

  const setFlag = useCallback(
    async (id: string, flag: "ns" | "lux" | "ptc") => {
      const p = participants.find((x) => x.id === id);
      if (!p) return;
      if (flag === "lux" || flag === "ptc") {
        const next = !p[flag];
        setParticipants((ps) => ps.map((x) => (x.id === id ? { ...x, [flag]: next } : x)));
        const { error } = await supabase.from("participants").update({ [flag]: next }).eq("id", id);
        if (error) toast("Error: " + error.message);
      } else {
        const cur = !!p.sessions[String(currentRound)]?.ns;
        await patchParticipantSession(id, currentRound, { ns: !cur });
      }
    },
    [currentRound, participants, patchParticipantSession, supabase, toast]
  );

  // ---- round inputs ----
  // Accepts either a patch object or a function of the round's CURRENT inputs, so
  // callers that fire several updates back-to-back (e.g. applying a preset) always
  // merge against the latest state instead of a stale render-time closure.
  const updateRoundInputs = useCallback(
    async (round: number, patchOrFn: Partial<RoundInputs> | ((inputs: RoundInputs) => Partial<RoundInputs>)) => {
      const r = roundsRef.current[round];
      if (!r) return;
      const patch = typeof patchOrFn === "function" ? patchOrFn(r.inputs) : patchOrFn;
      const nextInputs: RoundInputs = { ...r.inputs, ...patch };
      const roundId = r.id;

      roundsRef.current = { ...roundsRef.current, [round]: { ...r, inputs: nextInputs } };
      setRounds(roundsRef.current);

      const write = async () => {
        const { error } = await supabase.from("rounds").update({ inputs: nextInputs }).eq("id", roundId);
        if (error) toast("Error: " + error.message);
      };
      roundWriteQueueRef.current = roundWriteQueueRef.current.then(write, write);
      await roundWriteQueueRef.current;
    },
    [supabase, toast]
  );

  const setInput = useCallback(
    async <K extends keyof RoundInputs>(key: K, value: RoundInputs[K]) => {
      await updateRoundInputs(currentRound, { [key]: value } as Partial<RoundInputs>);
    },
    [currentRound, updateRoundInputs]
  );

  const setDisInput = useCallback(
    async (key: string, value: string | number | Partial<Record<Region, number>>) => {
      await updateRoundInputs(currentRound, (inputs) => ({
        dis: { ...defaultDisaster(), ...inputs.dis, [key]: value },
      }));
    },
    [currentRound, updateRoundInputs]
  );

  const setElecInput = useCallback(
    async (key: string, value: string | number | boolean | Partial<Record<Region, number>>) => {
      await updateRoundInputs(currentRound, (inputs) => ({
        elec: { ...defaultElection(), ...inputs.elec, [key]: value },
      }));
    },
    [currentRound, updateRoundInputs]
  );

  // Shallow-merge into the round's `circulation` object — used by the
  // Treasury & Circulation panel for region cash, group cash overrides,
  // bank fee counts, and the removal/injection repeaters.
  const setCirculationInput = useCallback(
    async (patch: Partial<RoundInputs["circulation"]>) => {
      await updateRoundInputs(currentRound, (inputs) => ({
        circulation: { ...defaultCirculation(), ...inputs.circulation, ...patch },
      }));
    },
    [currentRound, updateRoundInputs]
  );

  const tally = useCallback(
    async (key: "rioters" | "guardPosts" | "arrests" | "goalsPos" | "goalsNeg", d: number) => {
      await updateRoundInputs(currentRound, (inputs) => ({
        [key]: Math.max(0, (inputs[key] || 0) + d),
      }));
    },
    [currentRound, updateRoundInputs]
  );

  // ---- close / reopen ----
  const closeSession = useCallback(
    async (opts?: { force?: boolean }) => {
      const r = currentRound;
      if (participants.length === 0) return { ok: false as const };

      const unmarked = participants
        .filter((p) => !isDead(p, r - 1))
        .filter((p) => !p.sessions[String(r)]?.status);
      if (unmarked.length && !opts?.force) {
        return { ok: false as const, needsConfirm: unmarked.length };
      }
      for (const p of unmarked) {
        await patchParticipantSession(p.id, r, { status: "P" });
      }

      let lockedLevel = game.config.lockedLevel;
      if (r === 1 && game.config.lockLevel) {
        lockedLevel = sizeLevel(popCount(participants, r));
        await setConfig({ lockedLevel });
      }

      const lvl = game.config.lockLevel && lockedLevel ? lockedLevel : sizeLevel(popCount(participants, r));
      const roundRow = rounds[r];
      const results = computeRound({
        round: r,
        level: lvl,
        pop: popCount(participants, r),
        prev: prevIndicators(r),
        counts: {
          absentees: countStatus(participants, r, "A"),
          unemployed: countStatus(participants, r, "E"),
          deaths: newDeaths(participants, r),
        },
        inputs: roundRow.inputs,
        regionLiving: livingByRegion(participants, r),
      });

      setRounds((rs) => ({ ...rs, [r]: { ...rs[r], results, closed: true } }));
      await supabase.from("rounds").update({ results, closed: true }).eq("id", roundRow.id);

      let nextCurrent = r;
      if (r < game.config.numSessions) {
        nextCurrent = r + 1;
        if (!rounds[nextCurrent]) {
          const id = crypto.randomUUID();
          const inputs: RoundInputs = {
            ...defaultInputs(),
            basinAssets: Math.round(results.basinNet * 10) / 10,
            retsinAssets: Math.round(results.retsinNet * 10) / 10,
          };
          const newRound: Round = { id, game_id: gameId, round_no: nextCurrent, inputs, results: null, closed: false };
          setRounds((rs) => ({ ...rs, [nextCurrent]: newRound }));
          await supabase.from("rounds").insert({
            id,
            game_id: gameId,
            round_no: nextCurrent,
            inputs,
            results: null,
            closed: false,
          });
        }
      }
      setGame((g) => ({ ...g, current_round: nextCurrent }));
      await supabase.from("games").update({ current_round: nextCurrent }).eq("id", gameId);

      toast(`Session ${r} closed — payments computed`);
      return { ok: true as const, collapsed: results.mult === null };
    },
    [currentRound, gameId, game.config, participants, patchParticipantSession, prevIndicators, rounds, setConfig, supabase, toast]
  );

  const reopenRound = useCallback(
    async (roundNo: number) => {
      setGame((g) => ({ ...g, current_round: roundNo }));
      await supabase.from("games").update({ current_round: roundNo }).eq("id", gameId);
      const toReopen = Object.values(rounds).filter((r) => r.round_no >= roundNo);
      setRounds((rs) => {
        const next = { ...rs };
        for (const r of toReopen) next[r.round_no] = { ...next[r.round_no], closed: false };
        return next;
      });
      for (const r of toReopen) {
        await supabase.from("rounds").update({ closed: false }).eq("id", r.id);
      }
    },
    [gameId, rounds, supabase]
  );

  // ---- participant rules ----
  // Reference text only: nothing below feeds computeRound or the close/reopen flow.
  // Each write is optimistic; a failure re-syncs from the DB so the list can't keep
  // showing an edit that never landed.
  const addRule = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const nextOrder = rulesRef.current.reduce((max, r) => Math.max(max, r.sort_order), -1) + 1;
      const row: Rule = { id: crypto.randomUUID(), game_id: gameId, text: trimmed, sort_order: nextOrder };

      rulesRef.current = [...rulesRef.current, row];
      setRules(rulesRef.current);

      const { error } = await supabase
        .from("rules")
        .insert({ id: row.id, game_id: gameId, text: trimmed, sort_order: nextOrder });
      if (error) {
        toast("Error adding rule: " + error.message);
        await fetchAll({ silent: true });
      }
    },
    [fetchAll, gameId, supabase, toast]
  );

  const updateRule = useCallback(
    async (id: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      rulesRef.current = rulesRef.current.map((r) => (r.id === id ? { ...r, text: trimmed } : r));
      setRules(rulesRef.current);

      const { error } = await supabase.from("rules").update({ text: trimmed }).eq("id", id);
      if (error) {
        toast("Error saving rule: " + error.message);
        await fetchAll({ silent: true });
      }
    },
    [fetchAll, supabase, toast]
  );

  const deleteRule = useCallback(
    async (id: string) => {
      rulesRef.current = rulesRef.current.filter((r) => r.id !== id);
      setRules(rulesRef.current);

      const { error } = await supabase.from("rules").delete().eq("id", id);
      if (error) {
        toast("Error deleting rule: " + error.message);
        await fetchAll({ silent: true });
      }
    },
    [fetchAll, supabase, toast]
  );

  const value: GameContextValue = {
    loading,
    game,
    participants,
    heads,
    rounds,
    currentRound,
    rules,
    toasts,
    level,
    pop,
    prevIndicators,
    addParticipant,
    addParticipantsBulk,
    deleteParticipant,
    setRegion,
    autoRegions,
    setHead,
    reconcileHeadRoles,
    setConfig,
    regenerateShareLink,
    startNextSession,
    setStatus,
    setFlag,
    setInput,
    setDisInput,
    setElecInput,
    setCirculationInput,
    tally,
    closeSession,
    reopenRound,
    addRule,
    updateRule,
    deleteRule,
    toast,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
