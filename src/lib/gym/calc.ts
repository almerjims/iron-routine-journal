import type { Block, SessionExercise, SetEntry, Workout } from "./types";

/** Epley estimated 1RM; a single rep returns the weight itself. */
export function e1rm(weight: number | null, reps: number | null): number {
  const w = weight ?? 0;
  const r = reps ?? 0;
  if (r <= 0) return 0;
  if (r === 1) return w;
  return w * (1 + r / 30);
}

/** A set counts only when completed, not skipped and with reps. */
export const isDone = (s: SetEntry) => s.completed && !s.skipped && (s.reps ?? 0) > 0;
const isClosed = (s: SetEntry) => s.completed || s.skipped;

export function doneSets(w: Workout) {
  const out: { exerciseId: string; set: SetEntry }[] = [];
  for (const b of w.blocks)
    for (const it of b.items) {
      if (it.skipped) continue;
      for (const s of it.sets) if (isDone(s)) out.push({ exerciseId: it.exerciseId, set: s });
    }
  return out;
}

export function workoutVolume(w: Workout) {
  return doneSets(w).reduce((sum, { set }) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0);
}

export const byDateAsc = (a: Workout, b: Workout) => a.startedAt.localeCompare(b.startedAt);

export type PRType = "weight" | "reps" | "1rm";
export const PR_LABEL: Record<PRType, string> = {
  weight: "Heaviest weight",
  reps: "Best reps at weight",
  "1rm": "Best est. 1RM",
};

/**
 * Walk workouts chronologically and record which sets set a PR.
 * PRs are only awarded once an exercise has history from an earlier workout.
 */
export function computePRs(workouts: Workout[]): Map<string, PRType[]> {
  const result = new Map<string, PRType[]>();
  const rec = new Map<string, { maxW: number; best: number; repsAt: Map<number, number>; seen: boolean }>();
  for (const w of [...workouts].sort(byDateAsc)) {
    const touched = new Set<string>();
    for (const { exerciseId, set } of doneSets(w)) {
      let r = rec.get(exerciseId);
      if (!r) {
        r = { maxW: 0, best: 0, repsAt: new Map(), seen: false };
        rec.set(exerciseId, r);
      }
      const wt = set.weight ?? 0;
      const reps = set.reps ?? 0;
      const e = e1rm(wt, reps);
      if (r.seen) {
        const types: PRType[] = [];
        if (wt > r.maxW) types.push("weight");
        if (r.repsAt.has(wt) && reps > (r.repsAt.get(wt) ?? 0)) types.push("reps");
        if (e > r.best + 1e-9) types.push("1rm");
        if (types.length) result.set(set.id, types);
      }
      r.maxW = Math.max(r.maxW, wt);
      r.best = Math.max(r.best, e);
      r.repsAt.set(wt, Math.max(r.repsAt.get(wt) ?? 0, reps));
      touched.add(exerciseId);
    }
    touched.forEach((id) => (rec.get(id)!.seen = true));
  }
  return result;
}

export interface ExerciseSession {
  workoutId: string;
  workoutName: string;
  date: string;
  sets: { weight: number; reps: number }[];
  topWeight: number;
  best1rm: number;
  volume: number;
  bestSet: { weight: number; reps: number };
}

export function exerciseSessions(workouts: Workout[], exerciseId: string): ExerciseSession[] {
  const out: ExerciseSession[] = [];
  for (const w of [...workouts].sort(byDateAsc)) {
    const sets = doneSets(w)
      .filter((d) => d.exerciseId === exerciseId)
      .map((d) => ({ weight: d.set.weight ?? 0, reps: d.set.reps ?? 0 }));
    if (!sets.length) continue;
    let bestSet = sets[0]!;
    for (const s of sets) if (e1rm(s.weight, s.reps) > e1rm(bestSet.weight, bestSet.reps)) bestSet = s;
    out.push({
      workoutId: w.id,
      workoutName: w.name,
      date: w.startedAt,
      sets,
      topWeight: Math.max(...sets.map((s) => s.weight)),
      best1rm: Math.max(...sets.map((s) => e1rm(s.weight, s.reps))),
      volume: sets.reduce((a, s) => a + s.weight * s.reps, 0),
      bestSet,
    });
  }
  return out;
}

export function exerciseRecords(sessions: ExerciseSession[]) {
  if (!sessions.length) return null;
  let heaviest = { weight: 0, reps: 0, date: "" };
  let best1rm = { value: 0, weight: 0, reps: 0, date: "" };
  let bestVolume = { value: 0, weight: 0, reps: 0, date: "" };
  const repsAt = new Map<number, { reps: number; date: string }>();
  for (const s of sessions)
    for (const set of s.sets) {
      if (set.weight > heaviest.weight || (set.weight === heaviest.weight && set.reps > heaviest.reps))
        heaviest = { ...set, date: s.date };
      const e = e1rm(set.weight, set.reps);
      if (e > best1rm.value) best1rm = { value: e, ...set, date: s.date };
      const v = set.weight * set.reps;
      if (v > bestVolume.value) bestVolume = { value: v, ...set, date: s.date };
      const cur = repsAt.get(set.weight);
      if (!cur || set.reps > cur.reps) repsAt.set(set.weight, { reps: set.reps, date: s.date });
    }
  const repsAtWeight = [...repsAt.entries()]
    .map(([weight, v]) => ({ weight, ...v }))
    .sort((a, b) => b.weight - a.weight);
  return { heaviest, best1rm, bestVolume, repsAtWeight };
}

export type TrendStatus = "improving" | "maintaining" | "declining" | "new";

/** Compare avg best est. 1RM of the last ~3 sessions with the ~3 before, 2% tolerance. */
export function trendStatus(sessions: ExerciseSession[], tolerance = 0.02) {
  const v = sessions.map((s) => s.best1rm).filter((x) => x > 0);
  if (v.length < 2) return { status: "new" as TrendStatus, change: 0 };
  const k = Math.min(3, Math.floor(v.length / 2));
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const recent = avg(v.slice(-k));
  const prev = avg(v.slice(-2 * k, -k));
  const change = prev > 0 ? (recent - prev) / prev : 0;
  const status: TrendStatus = change > tolerance ? "improving" : change < -tolerance ? "declining" : "maintaining";
  return { status, change };
}

/** Last session's completed sets for an exercise among the given workouts. */
export function previousSets(workouts: Workout[], exerciseId: string) {
  const s = exerciseSessions(workouts, exerciseId);
  return s.length ? s[s.length - 1]!.sets : [];
}

export function groupProgress(block: Block<SessionExercise>) {
  const active = block.items.filter((i) => !i.skipped);
  const total = active.length ? Math.max(...active.map((i) => i.sets.length)) : 0;
  const pending = active.filter((i) => i.sets.some((s) => !isClosed(s)));
  const round = pending.length
    ? Math.min(...pending.map((i) => i.sets.filter(isClosed).length)) + 1
    : total;
  return { round: Math.min(round, total), total, complete: total > 0 && pending.length === 0 };
}

/** Round r (0-based) is complete when every active exercise that has that set closed it, with at least one completed. */
export function roundComplete(block: Block<SessionExercise>, r: number) {
  const rel = block.items.filter((i) => !i.skipped && i.sets.length > r);
  if (!rel.length) return false;
  return rel.every((i) => isClosed(i.sets[r]!)) && rel.some((i) => i.sets[r]!.completed);
}

/** Next recommended set: first open block; in groups the exercise with fewest closed sets, group order breaking ties (A1 → B1 → A2 → B2). */
export function nextUp(w: Workout): { itemId: string; setId: string } | null {
  for (const b of w.blocks) {
    const items = b.items.filter((i) => !i.skipped && i.sets.some((s) => !isClosed(s)));
    if (!items.length) continue;
    let best = items[0]!;
    if (b.kind === "group") {
      let bestDone = best.sets.filter(isClosed).length;
      for (const it of items) {
        const d = it.sets.filter(isClosed).length;
        if (d < bestDone) {
          best = it;
          bestDone = d;
        }
      }
    }
    return { itemId: best.id, setId: best.sets.find((s) => !isClosed(s))!.id };
  }
  return null;
}
