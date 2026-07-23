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
import {
  computeRound,
  defaultInputs,
  defaultDisaster,
  defaultElection,
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
} from "@/lib/types";

type Toast = { id: number; text: string };

type GameContextValue = {
  loading: boolean;
  game: Game;
  participants: Participant[];
  heads: GameHeads;
  rounds: Record<number, Round>;
  currentRound: number;
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
  setConfig: (patch: Partial<Game["config"]>) => Promise<void>;
  setStatus: (id: string, code: "P" | "A" | "E" | "D") => Promise<void>;
  setFlag: (id: string, flag: "ns" | "lux" | "ptc") => Promise<void>;
  setInput: <K extends keyof RoundInputs>(key: K, value: RoundInputs[K]) => Promise<void>;
  setDisInput: (key: string, value: string | number) => Promise<void>;
  setElecInput: (key: string, value: string | number | boolean) => Promise<void>;
  tally: (key: "rioters" | "guardPosts" | "arrests" | "goalsPos" | "goalsNeg", d: number) => Promise<void>;
  closeSession: (opts?: { force?: boolean }) => Promise<{ ok: boolean; needsConfirm?: number; collapsed?: boolean }>;
  reopenRound: (roundNo: number) => Promise<void>;
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

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: g }, { data: parts }, { data: headRows }, { data: roundRows }] =
      await Promise.all([
        supabase.from("games").select("*").eq("id", gameId).single(),
        supabase.from("participants").select("*").eq("game_id", gameId).order("name"),
        supabase.from("game_heads").select("*").eq("game_id", gameId),
        supabase.from("rounds").select("*").eq("game_id", gameId).order("round_no"),
      ]);

    if (g) setGame(g as Game);
    setParticipants((parts ?? []) as Participant[]);

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
    setRounds(roundMap);
    setLoading(false);
  }, [gameId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

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

  const setHead = useCallback(
    async (role: HeadRole, participantId: string | null) => {
      setHeads((h) => ({ ...h, [role]: participantId }));
      const { error } = await supabase
        .from("game_heads")
        .upsert({ game_id: gameId, role, participant_id: participantId });
      if (error) toast("Error: " + error.message);
    },
    [gameId, supabase, toast]
  );

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

  // ---- session marks ----
  const patchParticipantSession = useCallback(
    async (id: string, round: number, patch: Record<string, unknown>) => {
      let updatedSessions: Participant["sessions"] = {};
      setParticipants((ps) =>
        ps.map((p) => {
          if (p.id !== id) return p;
          updatedSessions = {
            ...p.sessions,
            [String(round)]: { ...p.sessions[String(round)], ...patch },
          };
          return { ...p, sessions: updatedSessions };
        })
      );
      const { error } = await supabase
        .from("participants")
        .update({ sessions: updatedSessions })
        .eq("id", id);
      if (error) toast("Error: " + error.message);
    },
    [supabase, toast]
  );

  const setStatus = useCallback(
    async (id: string, code: "P" | "A" | "E" | "D") => {
      const p = participants.find((x) => x.id === id);
      if (!p) return;
      const cur = p.sessions[String(currentRound)]?.status;
      await patchParticipantSession(id, currentRound, { status: cur === code ? null : code });
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
    async (key: string, value: string | number) => {
      await updateRoundInputs(currentRound, (inputs) => ({
        dis: { ...defaultDisaster(), ...inputs.dis, [key]: value },
      }));
    },
    [currentRound, updateRoundInputs]
  );

  const setElecInput = useCallback(
    async (key: string, value: string | number | boolean) => {
      await updateRoundInputs(currentRound, (inputs) => ({
        elec: { ...defaultElection(), ...inputs.elec, [key]: value },
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

  const value: GameContextValue = {
    loading,
    game,
    participants,
    heads,
    rounds,
    currentRound,
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
    setConfig,
    setStatus,
    setFlag,
    setInput,
    setDisInput,
    setElecInput,
    tally,
    closeSession,
    reopenRound,
    toast,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
