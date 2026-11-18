/**
 * Repository / data layer. All persistence goes through this module so the
 * localStorage backend can later be swapped for a cloud database.
 */
import { useSyncExternalStore } from "react";
import type {
  AppState, Block, Equipment, Exercise, MuscleGroup, PlannedExercise, Routine,
  SessionExercise, Settings, Workout,
} from "./types";
import { uid } from "./id";
import { seedExercises, seedRoutine } from "./seed";
import { previousSets, e1rm, doneSets } from "./calc";

const KEY = "gymlog.state.v1";

export const DEFAULT_SETTINGS: Settings = { restSeconds: 90, unit: "kg", sound: true, vibrate: true };

const SERVER_STATE: AppState = {
  version: 1, loaded: false, exercises: [], routines: [], currentRoutineId: null,
  workouts: [], active: null, settings: DEFAULT_SETTINGS, rest: null,
};

export function freshState(): AppState {
  const now = new Date().toISOString();
  const r = seedRoutine(now);
  return {
    version: 1, loaded: true, exercises: seedExercises(), routines: [r], currentRoutineId: r.id,
    workouts: [], active: null, settings: { ...DEFAULT_SETTINGS }, rest: null,
  };
}

function withDefaults(raw: Partial<AppState>): AppState {
  return {
    version: 1,
    loaded: true,
    exercises: Array.isArray(raw.exercises) ? raw.exercises : seedExercises(),
    routines: Array.isArray(raw.routines) ? raw.routines : [],
    currentRoutineId: raw.currentRoutineId ?? null,
    workouts: Array.isArray(raw.workouts) ? raw.workouts : [],
    active: raw.active ?? null,
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
    rest: raw.rest ?? null,
  };
}

let state: AppState | null = null;
const listeners = new Set<() => void>();

function load(): AppState {
  try {
    const txt = localStorage.getItem(KEY);
    if (txt) return withDefaults(JSON.parse(txt));
  } catch (e) {
    console.error("Failed to read saved data", e);
  }
  const s = freshState();
  persist(s);
  return s;
}

function persist(s: AppState) {
  try {
    const { loaded: _l, ...rest } = s;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch (e) {
    console.error("Failed to save", e);
  }
}

export function getState(): AppState {
  if (typeof window === "undefined") return SERVER_STATE;
  if (!state) state = load();
  return state;
}

function setState(fn: (s: AppState) => AppState) {
  state = fn(getState());
  persist(state);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = load();
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useGym(): AppState {
  return useSyncExternalStore(subscribe, getState, () => SERVER_STATE);
}

const clone = <T,>(x: T): T => structuredClone(x);

/* ---------- Exercises ---------- */
export function addExercise(name: string, muscle: MuscleGroup, equipment: Equipment): string {
  const id = uid();
  setState((s) => ({
    ...s,
    exercises: [...s.exercises, { id, name: name.trim(), muscle, equipment, custom: true, archived: false }],
  }));
  return id;
}
export function updateExercise(id: string, patch: Partial<Exercise>) {
  setState((s) => ({ ...s, exercises: s.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
}

/* ---------- Routines ---------- */
export function createRoutine(name: string): string {
  const now = new Date().toISOString();
  const r: Routine = { id: uid(), name: name.trim() || "New routine", blocks: [], createdAt: now, updatedAt: now };
  setState((s) => ({ ...s, routines: [...s.routines, r], currentRoutineId: s.currentRoutineId ?? r.id }));
  return r.id;
}
export function updateRoutine(id: string, mut: (r: Routine) => Routine | void) {
  setState((s) => ({
    ...s,
    routines: s.routines.map((r) => {
      if (r.id !== id) return r;
      const c = clone(r);
      const out = mut(c) ?? c;
      return { ...out, updatedAt: new Date().toISOString() };
    }),
  }));
}
export function duplicateRoutine(id: string): string | null {
  const src = getState().routines.find((r) => r.id === id);
  if (!src) return null;
  const now = new Date().toISOString();
  const copy: Routine = {
    ...clone(src),
    id: uid(),
    name: `${src.name} (copy)`,
    createdAt: now,
    updatedAt: now,
    blocks: src.blocks.map((b) => ({ ...clone(b), id: uid(), items: b.items.map((i) => ({ ...i, id: uid() })) })),
  };
  setState((s) => ({ ...s, routines: [...s.routines, copy] }));
  return copy.id;
}
export function deleteRoutine(id: string) {
  setState((s) => {
    const routines = s.routines.filter((r) => r.id !== id);
    return {
      ...s,
      routines,
      currentRoutineId: s.currentRoutineId === id ? (routines[0]?.id ?? null) : s.currentRoutineId,
    };
  });
}
export function setCurrentRoutine(id: string) {
  setState((s) => ({ ...s, currentRoutineId: id }));
}

export function newPlanned(exerciseId: string): PlannedExercise {
  return { id: uid(), exerciseId, sets: 3, repMin: 8, repMax: 12 };
}

/* ---------- Workouts ---------- */
export function makeSessionExercise(
  workouts: Workout[], exerciseId: string, count = 3, repMin?: number, repMax?: number,
): SessionExercise {
  const prev = previousSets(workouts, exerciseId);
  return {
    id: uid(),
    exerciseId,
    skipped: false,
    repMin,
    repMax,
    sets: Array.from({ length: Math.max(1, count) }, (_, i) => {
      const p = prev[i] ?? prev[prev.length - 1];
      return {
        id: uid(),
        weight: p ? p.weight : null,
        reps: p ? p.reps : (repMin ?? null),
        completed: false,
        skipped: false,
      };
    }),
  };
}

export function startWorkout(routineId: string | null) {
  setState((s) => {
    const r = routineId ? s.routines.find((x) => x.id === routineId) : null;
    const blocks: Block<SessionExercise>[] = (r?.blocks ?? []).map((b) => ({
      id: uid(),
      kind: b.kind,
      name: b.name,
      restSeconds: b.restSeconds,
      items: b.items.map((p) => makeSessionExercise(s.workouts, p.exerciseId, p.sets, p.repMin, p.repMax)),
    }));
    const w: Workout = {
      id: uid(), routineId: r?.id ?? null, name: r?.name ?? "Empty workout",
      startedAt: new Date().toISOString(), endedAt: null, notes: "", blocks,
    };
    // advance "next" routine to the following one
    let currentRoutineId = s.currentRoutineId;
    if (r) {
      const i = s.routines.findIndex((x) => x.id === r.id);
      currentRoutineId = s.routines[(i + 1) % s.routines.length]!.id;
    }
    return { ...s, active: w, rest: null, currentRoutineId };
  });
}

export function updateActive(mut: (w: Workout) => Workout | void) {
  setState((s) => {
    if (!s.active) return s;
    const c = clone(s.active);
    return { ...s, active: mut(c) ?? c };
  });
}

export function discardActive() {
  setState((s) => ({ ...s, active: null, rest: null }));
}

export function finishActive(): string | null {
  const a = getState().active;
  if (!a) return null;
  setState((s) => ({
    ...s,
    active: null,
    rest: null,
    workouts: [...s.workouts, { ...clone(a), endedAt: new Date().toISOString() }],
  }));
  return a.id;
}

export function updateWorkout(id: string, mut: (w: Workout) => Workout | void) {
  setState((s) => ({
    ...s,
    workouts: s.workouts.map((w) => {
      if (w.id !== id) return w;
      const c = clone(w);
      return mut(c) ?? c;
    }),
  }));
}

export function deleteWorkout(id: string) {
  setState((s) => ({ ...s, workouts: s.workouts.filter((w) => w.id !== id) }));
}

/* ---------- Rest timer ---------- */
export function startRest(seconds: number, label: string) {
  if (seconds <= 0) return;
  setState((s) => ({ ...s, rest: { endsAt: Date.now() + seconds * 1000, duration: seconds, label } }));
}
export function adjustRest(delta: number) {
  setState((s) =>
    s.rest ? { ...s, rest: { ...s.rest, endsAt: s.rest.endsAt + delta * 1000, duration: Math.max(1, s.rest.duration + delta) } } : s,
  );
}
export function clearRest() {
  setState((s) => ({ ...s, rest: null }));
}

/* ---------- Settings & backup ---------- */
export function updateSettings(patch: Partial<Settings>) {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function resetAll() {
  setState(() => freshState());
}

export function exportJSON(): string {
  const { loaded: _l, rest: _r, ...data } = getState();
  return JSON.stringify({ app: "gymlog", exportedAt: new Date().toISOString(), ...data }, null, 2);
}

export function parseBackup(text: string): Partial<AppState> {
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.workouts) || !Array.isArray(raw.exercises) || !Array.isArray(raw.routines))
    throw new Error("This file is not a valid backup.");
  return raw;
}

const unionById = <T extends { id: string }>(mine: T[], theirs: T[]) => {
  const ids = new Set(mine.map((x) => x.id));
  return [...mine, ...theirs.filter((x) => !ids.has(x.id))];
};

/** Merge keeps all existing records and only adds new ids, so nothing gets overwritten. */
export function importBackup(data: Partial<AppState>, mode: "merge" | "replace") {
  setState((s) => {
    if (mode === "replace") return { ...withDefaults(data), rest: null };
    return {
      ...s,
      exercises: unionById(s.exercises, data.exercises ?? []),
      routines: unionById(s.routines, data.routines ?? []),
      workouts: unionById(s.workouts, data.workouts ?? []),
    };
  });
}

export function exportCSV(): string {
  const s = getState();
  const ex = new Map(s.exercises.map((e) => [e.id, e]));
  const rows = [["date", "workout", "group", "exercise", "muscle", "set", "weight", "unit", "reps", "completed", "skipped", "est_1rm"]];
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  for (const w of [...s.workouts].sort((a, b) => a.startedAt.localeCompare(b.startedAt)))
    for (const b of w.blocks)
      for (const it of b.items)
        it.sets.forEach((set, i) =>
          rows.push([
            w.startedAt, w.name, b.kind === "group" ? b.name : "", ex.get(it.exerciseId)?.name ?? "Unknown",
            ex.get(it.exerciseId)?.muscle ?? "", String(i + 1), String(set.weight ?? ""), s.settings.unit,
            String(set.reps ?? ""), String(set.completed), String(set.skipped || it.skipped),
            set.completed ? e1rm(set.weight, set.reps).toFixed(1) : "",
          ]),
        );
  return rows.map((r) => r.map(q).join(",")).join("\n");
}

export { doneSets };
