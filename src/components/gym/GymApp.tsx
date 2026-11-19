import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowDown, ArrowLeft, ArrowUp, BarChart3, CalendarDays, Check,
  ChevronRight, CircleCheck, Clock3, Copy, Dumbbell, FileDown, FileUp,
  History, Home, ListChecks, Minus, MoreHorizontal, Pause, Pencil, Plus,
  RotateCcw, Settings2, SkipForward, Sparkles, Timer, Trash2, Trophy,
  TrendingUp, Undo2, X,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, EmptyState, Stat, Stepper, StatusBadge, RestSelect, fmtRest } from "@/components/gym/ui";
import { useNow } from "@/components/gym/hooks";
import { groupItems, groupIndex, moveIndex, moveItemWithin, normalize, ungroup } from "@/lib/gym/blocks";
import { doneSets, computePRs, e1rm, exerciseRecords, exerciseSessions, nextUp, trendStatus, workoutVolume, groupProgress } from "@/lib/gym/calc";
import { fmtClock, fmtDate, fmtDuration, fmtNum, fmtShortDate, fmtVolume, workoutDuration } from "@/lib/gym/format";
import {
  addExercise, adjustRest, clearRest, createRoutine, deleteRoutine, deleteWorkout,
  discardActive, duplicateRoutine, exportCSV, exportJSON, finishActive, importBackup,
  makeSessionExercise, newPlanned, parseBackup, resetAll, setCurrentRoutine,
  startRest, startWorkout, updateActive, updateExercise, updateRoutine, updateSettings,
  updateWorkout, useGym,
} from "@/lib/gym/store";
import { EQUIPMENT, MUSCLE_GROUPS, type Block, type Equipment, type Exercise, type MuscleGroup, type PlannedExercise, type Routine, type SessionExercise, type SetEntry, type Workout } from "@/lib/gym/types";
import { Button as UIButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type View = "home" | "workouts" | "start" | "progress" | "history" | "exercises" | "settings" | "summary";
type ChartMetric = "weight" | "e1rm" | "volume";
const NAV_ITEMS: { id: View; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home }, { id: "workouts", label: "Workouts", icon: ListChecks },
  { id: "start", label: "Start", icon: Dumbbell }, { id: "progress", label: "Progress", icon: BarChart3 },
  { id: "history", label: "History", icon: History },
];

function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function dateKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function blockItems<T>(block: Block<T>) {
  return block.items;
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-lg border bg-card", className)}>{children}</section>;
}

function SectionLabel({ children, trailing }: { children: React.ReactNode; trailing?: React.ReactNode }) {
  return <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold uppercase">{children}</h2>{trailing}</div>;
}

function SmallButton({ label, onClick, children, variant = "ghost", disabled }: { label: string; onClick: () => void; children: React.ReactNode; variant?: "ghost" | "outline" | "secondary" | "destructive"; disabled?: boolean }) {
  return <Button type="button" size="icon-sm" variant={variant} aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</Button>;
}

export function GymApp() {
  const state = useGym();
  const now = useNow();
  const [view, setView] = useState<View>("home");
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseMuscle, setExerciseMuscle] = useState("all");
  const [exerciseEquipment, setExerciseEquipment] = useState("all");
  const [routineSearch, setRoutineSearch] = useState("");
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [customName, setCustomName] = useState("");
  const [customMuscle, setCustomMuscle] = useState<MuscleGroup>("Chest");
  const [customEquipment, setCustomEquipment] = useState<Equipment>("Barbell");
  const [newRoutineName, setNewRoutineName] = useState("");
  const [metric, setMetric] = useState<ChartMetric>("e1rm");
  const [range, setRange] = useState("all");
  const [importMessage, setImportMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const active = state.active;
  const exerciseById = useMemo(() => new Map(state.exercises.map((x) => [x.id, x])), [state.exercises]);
  const routines = state.routines;
  const currentRoutine = routines.find((r) => r.id === state.currentRoutineId) ?? routines[0];
  const activeWorkout = active;
  const selectedRoutine = routines.find((r) => r.id === routineId);
  const selectedExercise = state.exercises.find((e) => e.id === exerciseId);
  const selectedWorkout = state.workouts.find((w) => w.id === workoutId);
  const summaryWorkout = state.workouts.find((w) => w.id === summaryId);
  const activeStart = activeWorkout ? new Date(activeWorkout.startedAt).getTime() : now;
  const activeElapsed = now - activeStart;
  const restRemaining = state.rest ? Math.max(0, Math.ceil((state.rest.endsAt - now) / 1000)) : 0;

  useEffect(() => {
    if (state.rest && restRemaining === 0) {
      if (state.settings.vibrate && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(180);
      if (state.settings.sound) {
        try {
          const Ctx = window.AudioContext;
          if (Ctx) {
            const ctx = new Ctx();
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            oscillator.frequency.value = 660;
            gain.gain.value = 0.08;
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.16);
          }
        } catch { /* audio is optional */ }
      }
      clearRest();
    }
  }, [state.rest, restRemaining, state.settings.sound, state.settings.vibrate]);

  function openView(next: View) {
    setView(next);
    if (next !== "workouts") setRoutineId(null);
    if (next !== "progress") setExerciseId(null);
    if (next !== "history") setWorkoutId(null);
  }

  function beginWorkout(id: string | null) {
    if (!active) startWorkout(id);
    openView("start");
  }

  function updateRoutineBlocks(id: string, fn: (blocks: Block<PlannedExercise>[]) => Block<PlannedExercise>[]) {
    updateRoutine(id, (r) => { r.blocks = fn(r.blocks); });
  }

  function updateWorkoutBlocks(id: string, fn: (blocks: Block<SessionExercise>[]) => Block<SessionExercise>[]) {
    updateWorkout(id, (w) => { w.blocks = fn(w.blocks); });
  }

  function visibleExercises(includeArchived = false) {
    return state.exercises.filter((e) => (includeArchived || !e.archived) &&
      (exerciseMuscle === "all" || e.muscle === exerciseMuscle) &&
      (exerciseEquipment === "all" || e.equipment === exerciseEquipment) &&
      e.name.toLowerCase().includes(exerciseSearch.toLowerCase()));
  }

  function saveCustomExercise(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customName.trim()) return;
    if (editingExercise) updateExercise(editingExercise.id, { name: customName.trim(), muscle: customMuscle, equipment: customEquipment });
    else addExercise(customName.trim(), customMuscle, customEquipment);
    setCustomName(""); setEditingExercise(null); setCustomOpen(false);
  }

  function openCustom(exercise?: Exercise) {
    setEditingExercise(exercise ?? null);
    setCustomName(exercise?.name ?? "");
    setCustomMuscle(exercise?.muscle ?? "Chest");
    setCustomEquipment(exercise?.equipment ?? "Barbell");
    setCustomOpen(true);
  }

  function editPlanned(rid: string, planId: string, field: "sets" | "repMin" | "repMax", value: number | null) {
    if (value == null) return;
    updateRoutine(rid, (r) => {
      for (const b of r.blocks) for (const item of b.items) if (item.id === planId) item[field] = Math.max(1, value);
    });
  }

  function closeSet(itemId: string, setId: string, mode: "complete" | "skip" | "reopen") {
    if (!active) return;
    const block = active.blocks.find((b) => b.items.some((i) => i.id === itemId));
    const item = block?.items.find((i) => i.id === itemId);
    const set = item?.sets.find((s) => s.id === setId);
    if (!block || !item || !set) return;
    const round = item.sets.indexOf(set);
    const completed = mode === "complete";
    const shouldRest = completed && !set.completed && !set.skipped && (block.kind === "single" ||
      block.items.filter((i) => !i.skipped && i.sets[round]).every((i) => i.id === itemId || i.sets[round]?.completed || i.sets[round]?.skipped));
    updateActive((w) => {
      for (const b of w.blocks) for (const ex of b.items) if (ex.id === itemId) {
        const target = ex.sets.find((s) => s.id === setId);
        if (!target) continue;
        target.completed = mode === "complete";
        target.skipped = mode === "skip";
      }
    });
    if (shouldRest) {
      const seconds = block.kind === "group" ? block.restSeconds ?? state.settings.restSeconds : state.settings.restSeconds;
      if (seconds > 0) startRest(seconds, block.kind === "group" ? `${block.name} round complete` : "Set complete");
    }
  }

  function editActiveSet(itemId: string, setId: string, field: "weight" | "reps", value: number | null) {
    updateActive((w) => { for (const b of w.blocks) for (const it of b.items) if (it.id === itemId) {
      const set = it.sets.find((s) => s.id === setId); if (set) set[field] = value;
    } });
  }

  function addActiveSet(itemId: string, allInGroup = false) {
    if (!active) return;
    updateActive((w) => { for (const b of w.blocks) for (const it of b.items) {
      if (it.id === itemId || (allInGroup && b.id === w.blocks.find((x) => x.items.some((i) => i.id === itemId))?.id)) {
        const last = it.sets.at(-1);
        it.sets.push({ id: crypto.randomUUID(), weight: last?.weight ?? null, reps: last?.reps ?? it.repMin ?? null, completed: false, skipped: false });
      }
    } });
  }

  function finishWorkout() {
    const id = finishActive();
    if (id) { setSummaryId(id); openView("summary"); }
  }

  function deleteWorkoutWithConfirm(id: string) {
    if (window.confirm("Delete this workout? This cannot be undone.")) {
      deleteWorkout(id); setWorkoutId(null); openView("history");
    }
  }

  function importFile(file: File | undefined) {
    if (!file) return;
    void file.text().then((text) => {
      try {
        const data = parseBackup(text);
        const replace = window.confirm("Choose OK to replace all your data, or Cancel to merge this backup without overwriting existing records.");
        importBackup(data, replace ? "replace" : "merge");
        setImportMessage(replace ? "Backup restored." : "Backup merged. Existing records were kept.");
      } catch (error) {
        setImportMessage(error instanceof Error ? error.message : "Could not read this backup.");
      }
    });
  }

  function renderRoutineCard(r: Routine) {
    const count = r.blocks.reduce((sum, b) => sum + b.items.length, 0);
    return <Card key={r.id} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setRoutineId(r.id); setSelectedPlans([]); }}>
          <div className="flex items-center gap-2"><h3 className="truncate text-xl font-bold">{r.name}</h3>{r.id === state.currentRoutineId && <span className="rounded-sm bg-primary/15 px-2 py-1 text-xs font-semibold text-primary">UP NEXT</span>}</div>
          <p className="mt-1 text-sm text-muted-foreground">{count} exercises · {r.blocks.length} {r.blocks.length === 1 ? "block" : "blocks"}</p>
        </button>
        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${r.name}`} onClick={() => { setRoutineId(r.id); setSelectedPlans([]); }}><Pencil /></Button>
      </div>
      <div className="mt-3 flex gap-2 border-t pt-3">
        <Button className="flex-1" onClick={() => beginWorkout(r.id)}><Dumbbell /> Start</Button>
        <Button variant="outline" size="icon" aria-label={`Set ${r.name} as next`} title="Set as next" onClick={() => setCurrentRoutine(r.id)}><CircleCheck /></Button>
        <Button variant="outline" size="icon" aria-label={`Duplicate ${r.name}`} title="Duplicate" onClick={() => duplicateRoutine(r.id)}><Copy /></Button>
        <Button variant="outline" size="icon" aria-label={`Delete ${r.name}`} title="Delete" onClick={() => { if (window.confirm(`Delete ${r.name}?`)) deleteRoutine(r.id); }}><Trash2 /></Button>
      </div>
    </Card>;
  }

  function renderHeaderAction() {
    return <Button variant="ghost" size="icon" aria-label="Settings" onClick={() => openView("settings")}><Settings2 /></Button>;
  }

  function renderHome() {
    const weekStart = new Date(); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weekCount = state.workouts.filter((w) => new Date(w.startedAt) >= weekStart).length;
    const weekly = Array.from({ length: 8 }, (_, index) => {
      const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - (7 * (7 - index)));
      const end = new Date(monday); end.setDate(monday.getDate() + 7);
      return { week: fmtShortDate(monday.toISOString()), workouts: state.workouts.filter((w) => { const d = new Date(w.startedAt); return d >= monday && d < end; }).length };
    });
    const progressItems = state.exercises.filter((e) => exerciseSessions(state.workouts, e.id).length >= 2);
    const improving = progressItems.filter((e) => trendStatus(exerciseSessions(state.workouts, e.id)).status === "improving").length;
    const prs = computePRs(state.workouts);
    const latestPRs = state.workouts.flatMap((w) => doneSets(w).filter(({ set }) => prs.has(set.id)).map(({ exerciseId: exId, set }) => ({ ex: exerciseById.get(exId)?.name ?? "Exercise", set, date: w.startedAt }))).slice(-3).reverse();
    const recent = [...state.workouts].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 3);
    return <>
      <PageHeader title="Good work starts here" subtitle={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} actions={renderHeaderAction()} />
      {active && <Card className="mb-5 border-primary/50 bg-primary/5 p-4">
        <div className="flex items-center gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/15 text-primary"><Activity /></div><div className="min-w-0 flex-1"><div className="text-xs font-semibold uppercase text-primary">Workout in progress · {fmtClock(activeElapsed)}</div><div className="truncate text-lg font-bold">{active.name}</div></div><Button onClick={() => openView("start")}>Resume</Button></div>
      </Card>}
      <Card className="mb-5 overflow-hidden border-primary/25 bg-gradient-to-br from-card to-primary/10 p-5">
        <div className="text-xs font-bold uppercase tracking-wide text-primary">{active ? "Ready when you are" : "Your next session"}</div>
        <div className="mt-2 text-3xl font-bold">{active ? active.name : currentRoutine?.name ?? "Build your first routine"}</div>
        <div className="mt-1 text-sm text-muted-foreground">{active ? "Pick up right where you left off." : currentRoutine ? `${currentRoutine.blocks.reduce((n, b) => n + b.items.length, 0)} exercises · Your plan, your pace.` : "Create a routine and make it yours."}</div>
        <Button className="mt-5 w-full" size="lg" onClick={() => active ? openView("start") : currentRoutine ? beginWorkout(currentRoutine.id) : openView("workouts")}><Dumbbell />{active ? "Resume workout" : currentRoutine ? "Start workout" : "Create routine"}</Button>
      </Card>
      <div className="mb-6 grid grid-cols-2 gap-3"><Stat label="Workouts" value={state.workouts.length} sub="All time" /><Stat label="This week" value={weekCount} sub="Since Monday" /></div>
      <Card className="mb-6 p-4"><SectionLabel>Weekly rhythm <span className="text-xs font-medium normal-case text-muted-foreground">Last 8 weeks</span></SectionLabel>
        <div className="h-44" role="img" aria-label="Workouts completed each week for the last eight weeks"><ResponsiveContainer width="100%" height="100%"><AreaChart data={weekly} margin={{ top: 5, right: 4, left: -24, bottom: 0 }}><defs><linearGradient id="weeklyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 4" /><XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} /><YAxis allowDecimals={false} width={30} tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} /><Tooltip contentStyle={{ background: "var(--color-popover)", borderColor: "var(--color-border)", borderRadius: 8 }} /><Area dataKey="workouts" type="monotone" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#weeklyFill)" /></AreaChart></ResponsiveContainer></div>
      </Card>
      <div className="mb-6 grid gap-3 sm:grid-cols-2"><Card className="p-4"><div className="flex items-center gap-2 text-sm font-semibold"><TrendingUp className="size-4 text-primary" /> Strength trend</div><div className="mt-2 text-2xl font-bold">{progressItems.length ? `${Math.round((improving / progressItems.length) * 100)}%` : "—"}</div><p className="text-xs text-muted-foreground">{progressItems.length ? `${improving} of ${progressItems.length} tracked lifts improving` : "Log at least two sessions per lift to see your trend."}</p></Card><Card className="p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Trophy className="size-4 text-pr" /> Recent records</div>{latestPRs.length ? latestPRs.map((p, i) => <div key={`${p.set.id}-${i}`} className="mt-2 flex justify-between gap-2 text-sm"><span className="truncate">{p.ex}</span><span className="shrink-0 text-primary">{fmtNum(p.set.weight)} kg × {p.set.reps}</span></div>) : <p className="mt-2 text-sm text-muted-foreground">Your new records will show here as you train.</p>}</Card></div>
      <SectionLabel trailing={<Button variant="ghost" size="sm" onClick={() => openView("history")}>See all <ChevronRight /></Button>}>Recent workouts</SectionLabel>
      {recent.length ? <div className="space-y-2">{recent.map((w) => <button type="button" key={w.id} onClick={() => { setWorkoutId(w.id); openView("history"); }} className="flex min-h-16 w-full items-center gap-3 border-b py-3 text-left"><div className="grid size-10 place-items-center rounded-md bg-secondary"><Dumbbell className="size-4 text-primary" /></div><div className="min-w-0 flex-1"><div className="truncate font-semibold">{w.name}</div><div className="text-xs text-muted-foreground">{fmtDate(w.startedAt)} · {fmtDuration(workoutDuration(w))}</div></div><div className="text-right text-sm font-semibold">{fmtVolume(workoutVolume(w))}<span className="ml-1 text-xs text-muted-foreground">kg</span></div></button>)}</div> : <EmptyState icon={<Dumbbell />} title="Your training starts here" text="Your first workout will appear here after you log it." action={<Button onClick={() => currentRoutine ? beginWorkout(currentRoutine.id) : openView("workouts")}>Start your first workout</Button>} />}
      <div className="mt-5 flex gap-2"><Button variant="outline" className="flex-1" onClick={() => openView("workouts")}><ListChecks /> Routines</Button><Button variant="outline" className="flex-1" onClick={() => openView("exercises")}><Dumbbell /> Exercises</Button></div>
    </>;
  }

  function renderWorkouts() {
    if (selectedRoutine) return renderRoutineEditor(selectedRoutine);
    const filtered = routines.filter((r) => r.name.toLowerCase().includes(routineSearch.toLowerCase()));
    return <>
      <PageHeader title="Workouts" subtitle="Your routines, ready when you are." actions={renderHeaderAction()} />
      <div className="mb-4 flex gap-2"><Input value={newRoutineName} onChange={(e) => setNewRoutineName(e.target.value)} placeholder="Name a new routine" aria-label="New routine name" className="h-12" onKeyDown={(e) => { if (e.key === "Enter" && newRoutineName.trim()) { createRoutine(newRoutineName); setNewRoutineName(""); } }} /><Button className="shrink-0" onClick={() => { if (newRoutineName.trim()) createRoutine(newRoutineName); setNewRoutineName(""); }}><Plus /> Create</Button></div>
      <Input value={routineSearch} onChange={(e) => setRoutineSearch(e.target.value)} placeholder="Find a routine" aria-label="Search routines" className="mb-4 h-11" />
      <div className="mb-5 grid gap-3">{filtered.map(renderRoutineCard)}{!filtered.length && <EmptyState icon={<ListChecks />} title="No routines yet" text="Create a routine to plan your next workout." />}</div>
      <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => openView("exercises")}><Dumbbell /> Exercise library</Button><Button variant="outline" onClick={() => openView("settings")}><Settings2 /> Settings</Button></div>
    </>;
  }

  function renderRoutineEditor(r: Routine) {
    const allPlans = r.blocks.flatMap((b) => b.items.map((it) => ({ ...it, kind: b.kind, group: b.name, blockId: b.id })));
    return <>
      <div className="mb-5 flex items-center gap-2"><Button variant="ghost" size="icon" aria-label="Back to routines" onClick={() => setRoutineId(null)}><ArrowLeft /></Button><div className="min-w-0 flex-1"><Input aria-label="Routine name" value={r.name} onChange={(e) => updateRoutine(r.id, (current) => { current.name = e.target.value; })} className="h-12 border-0 px-0 text-2xl font-bold focus-visible:ring-0" /></div><Button variant="outline" size="icon" aria-label="Set routine as next" title="Set as next" onClick={() => setCurrentRoutine(r.id)}><CircleCheck /></Button></div>
      <p className="mb-4 text-sm text-muted-foreground">Set a plan, adjust it anytime.</p>
      <Card className="mb-4 p-4"><SectionLabel trailing={<Button variant="ghost" size="sm" onClick={() => openView("exercises")}>Library <ChevronRight /></Button>}>Add exercises</SectionLabel>
        <Input value={exerciseSearch} onChange={(e) => setExerciseSearch(e.target.value)} placeholder="Search exercise library" aria-label="Search exercises to add" className="mb-3 h-11" />
        <div className="max-h-64 space-y-1 overflow-y-auto">{state.exercises.filter((e) => !e.archived && e.name.toLowerCase().includes(exerciseSearch.toLowerCase())).slice(0, 25).map((exercise) => <label key={exercise.id} className="flex min-h-12 items-center gap-3 border-b border-border/60 px-1"><Checkbox checked={selectedPlans.includes(exercise.id)} onCheckedChange={(checked) => setSelectedPlans((prev) => checked ? [...prev, exercise.id] : prev.filter((x) => x !== exercise.id))} aria-label={`Select ${exercise.name}`} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{exercise.name}</span><span className="text-xs text-muted-foreground">{exercise.muscle} · {exercise.equipment}</span></span></label>)}</div>
        <div className="mt-3 flex gap-2"><Button className="flex-1" disabled={!selectedPlans.length} onClick={() => { updateRoutineBlocks(r.id, (blocks) => [...blocks, ...selectedPlans.map((id) => ({ id: crypto.randomUUID(), kind: "single" as const, name: "", restSeconds: null, items: [newPlanned(id)] }))]); setSelectedPlans([]); setExerciseSearch(""); }}>Add {selectedPlans.length || "selected"}</Button><Button variant="outline" disabled={selectedPlans.length < 2} onClick={() => { updateRoutineBlocks(r.id, (blocks) => groupItems(blocks, selectedPlans.map((id) => { const found = blocks.flatMap((b) => b.items).find((p) => p.exerciseId === id); return found?.id ?? ""; }))); setSelectedPlans([]); }}>Group as superset</Button></div>
      </Card>
      <SectionLabel>Routine plan <span className="text-xs font-medium normal-case text-muted-foreground">{allPlans.length} exercises</span></SectionLabel>
      {!r.blocks.length ? <EmptyState icon={<Dumbbell />} title="A fresh start" text="Choose exercises above to build this routine." /> : <div className="space-y-3">{r.blocks.map((block, index) => {
        const gIndex = groupIndex(r.blocks, block.id);
        const group = block.kind === "group";
        return <Card key={block.id} className={cn("p-3", group && "border-l-4 border-l-primary")}>
          {group && <div className="mb-2 flex items-center gap-2"><span className="rounded-sm bg-primary/15 px-2 py-1 text-xs font-bold uppercase text-primary">{block.items.length >= 3 ? "Giant set" : "Superset"} {String.fromCharCode(65 + gIndex)}</span><Input aria-label="Superset name" value={block.name} onChange={(e) => updateRoutineBlocks(r.id, (blocks) => blocks.map((b) => b.id === block.id ? { ...b, name: e.target.value } : b))} className="h-9 flex-1" /><RestSelect value={block.restSeconds} onChange={(value) => updateRoutineBlocks(r.id, (blocks) => blocks.map((b) => b.id === block.id ? { ...b, restSeconds: value } : b))} defaultSeconds={state.settings.restSeconds} /><Button variant="outline" size="icon-sm" aria-label="Ungroup exercises" title="Ungroup" onClick={() => updateRoutineBlocks(r.id, (blocks) => ungroup(blocks, block.id))}><Undo2 /></Button></div>}
          {block.items.map((plan, itemIndex) => {
            const name = exerciseById.get(plan.exerciseId)?.name ?? "Unknown exercise";
            return <div key={plan.id} className={cn("py-2", itemIndex && "border-t border-border/60")}>
              <div className="mb-2 flex items-center gap-2"><Checkbox aria-label={`Select ${name} for grouping`} checked={selectedPlans.includes(plan.id)} onCheckedChange={(checked) => setSelectedPlans((prev) => checked ? [...prev, plan.id] : prev.filter((x) => x !== plan.id))} /><div className="min-w-0 flex-1"><div className="truncate font-semibold">{name}</div><div className="text-xs text-muted-foreground">{exerciseById.get(plan.exerciseId)?.muscle ?? ""}</div></div><SmallButton label="Move up" disabled={!itemIndex && !index} onClick={() => group ? updateRoutineBlocks(r.id, (blocks) => moveItemWithin(blocks, block.id, itemIndex, itemIndex - 1)) : updateRoutineBlocks(r.id, (blocks) => moveIndex(blocks, index, index - 1))}><ArrowUp /></SmallButton><SmallButton label="Move down" disabled={itemIndex === block.items.length - 1 && index === r.blocks.length - 1} onClick={() => group ? updateRoutineBlocks(r.id, (blocks) => moveItemWithin(blocks, block.id, itemIndex, itemIndex + 1)) : updateRoutineBlocks(r.id, (blocks) => moveIndex(blocks, index, index + 1))}><ArrowDown /></SmallButton><SmallButton label={`Remove ${name}`} onClick={() => updateRoutineBlocks(r.id, (blocks) => normalize(blocks.map((b) => ({ ...b, items: b.items.filter((p) => p.id !== plan.id) }))))}><X /></SmallButton></div>
              <div className="grid grid-cols-3 gap-2"><div><span className="mb-1 block text-[11px] text-muted-foreground">SETS</span><Stepper value={plan.sets} onChange={(v) => editPlanned(r.id, plan.id, "sets", v)} step={1} label={`${name} sets`} /></div><div><span className="mb-1 block text-[11px] text-muted-foreground">MIN REPS</span><Stepper value={plan.repMin} onChange={(v) => editPlanned(r.id, plan.id, "repMin", v)} step={1} label={`${name} minimum reps`} /></div><div><span className="mb-1 block text-[11px] text-muted-foreground">MAX REPS</span><Stepper value={plan.repMax} onChange={(v) => editPlanned(r.id, plan.id, "repMax", v)} step={1} label={`${name} maximum reps`} /></div></div>
            </div>;
          })}
          {!group && <div className="mt-2 flex items-center justify-between border-t pt-2"><RestSelect value={block.restSeconds} onChange={(value) => updateRoutineBlocks(r.id, (blocks) => blocks.map((b) => b.id === block.id ? { ...b, restSeconds: value } : b))} defaultSeconds={state.settings.restSeconds} /><Button variant="ghost" size="sm" onClick={() => updateRoutineBlocks(r.id, (blocks) => groupItems(blocks, block.items.map((p) => p.id)))} disabled={block.items.length < 1 || index === r.blocks.length - 1}><Plus /> Group with next</Button></div>}
        </Card>;
      })}</div>}
      <div className="mt-5 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => duplicateRoutine(r.id)}><Copy /> Duplicate</Button><Button onClick={() => beginWorkout(r.id)}><Dumbbell /> Start this routine</Button></div>
    </>;
  }

  function renderStart() {
    if (!active) return <>
      <PageHeader title="Start workout" subtitle="Choose your plan, or start with a blank slate." actions={renderHeaderAction()} />
      <Button className="mb-5 w-full" size="lg" onClick={() => beginWorkout(null)}><Plus /> Empty workout</Button>
      <SectionLabel>Choose a routine</SectionLabel>
      {routines.length ? <div className="space-y-3">{routines.map(renderRoutineCard)}</div> : <EmptyState icon={<ListChecks />} title="No routines yet" text="Build a routine first, or start with an empty workout." action={<Button onClick={() => openView("workouts")}>Create routine</Button>} />}
    </>;
    const next = nextUp(active);
    const totalSets = active.blocks.reduce((sum, b) => sum + b.items.reduce((n, it) => n + it.sets.filter((s) => s.completed).length, 0), 0);
    const totalTargets = active.blocks.reduce((sum, b) => sum + b.items.filter((it) => !it.skipped).reduce((n, it) => n + it.sets.length, 0), 0);
    return <>
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b bg-background/95 px-4 pb-3 pt-1 backdrop-blur">
        <div className="flex items-center gap-2"><Button variant="ghost" size="icon" aria-label="Workout options" onClick={() => { if (window.confirm("Discard this workout? Your unsaved session will be removed.")) { discardActive(); openView("home"); } }}><Pause /></Button><div className="min-w-0 flex-1"><Input aria-label="Workout name" value={active.name} onChange={(e) => updateActive((w) => { w.name = e.target.value; })} className="h-10 border-0 px-0 text-xl font-bold focus-visible:ring-0"/><div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Clock3 className="size-3" />{fmtClock(activeElapsed)}</span><span>{totalSets}/{totalTargets} sets</span></div></div><Button onClick={finishWorkout}>Finish</Button></div>
      </div>
      <div className="mb-4 flex items-center justify-between"><span className="text-xs font-semibold uppercase text-primary">Active session</span><Button variant="outline" size="sm" onClick={() => openView("exercises")}><Plus /> Exercise</Button></div>
      {!active.blocks.length && <EmptyState icon={<Dumbbell />} title="Add your first exercise" text="Build today’s session from your exercise library." action={<Button onClick={() => openView("exercises")}>Browse exercises</Button>} />}
      <div className="space-y-3">{active.blocks.map((block, bi) => {
        const group = block.kind === "group";
        const progress = group ? groupProgress(block) : null;
        const nextItem = group ? nextUp(active)?.itemId : null;
        return <Card key={block.id} className={cn("p-3", group && "border-l-4 border-l-primary")}>
          {group && <div className="mb-3 flex items-center gap-2"><span className="rounded-sm bg-primary/15 px-2 py-1 text-xs font-bold uppercase text-primary">{block.items.length >= 3 ? "Giant set" : "Superset"}</span><Input aria-label="Workout group name" value={block.name} onChange={(e) => updateActive((w) => { const b = w.blocks.find((x) => x.id === block.id); if (b) b.name = e.target.value; })} className="h-9 min-w-0 flex-1"/><span className="text-xs text-muted-foreground">Round {progress?.round ?? 0}/{progress?.total ?? 0}</span></div>}
          {block.items.map((item, ei) => renderActiveExercise(block, item, bi, ei, nextItem === item.id))}
          {group && <div className="mt-2 flex items-center justify-between border-t pt-2"><RestSelect value={block.restSeconds} onChange={(value) => updateActive((w) => { const b = w.blocks.find((x) => x.id === block.id); if (b) b.restSeconds = value; })} defaultSeconds={state.settings.restSeconds} /><Button variant="outline" size="sm" onClick={() => addActiveSet(block.items[0]?.id ?? "", true)} disabled={!block.items.length}><Plus /> Add round</Button></div>}
        </Card>;
      })}</div>
      <Card className="mt-4 p-3"><label className="mb-2 block text-sm font-semibold">Workout notes</label><Textarea aria-label="Workout notes" value={active.notes} onChange={(e) => updateActive((w) => { w.notes = e.target.value; })} placeholder="How did it feel?" /></Card>
      <Button className="mt-4 w-full" size="lg" onClick={finishWorkout}><Check /> Finish workout</Button>
      {state.rest && <Card className="fixed inset-x-3 bottom-20 z-30 border-primary bg-card p-4 shadow-xl sm:inset-x-auto sm:right-5 sm:w-80"><div className="flex items-center justify-between"><span className="text-sm font-semibold">{state.rest.label}</span><Button variant="ghost" size="icon-sm" aria-label="Skip rest" onClick={clearRest}><SkipForward /></Button></div><div className="my-2 text-center font-display text-4xl font-bold tabular-nums">{fmtRest(restRemaining)}</div><div className="flex justify-center gap-2"><Button variant="outline" size="sm" onClick={() => adjustRest(-15)}><Minus /> 15s</Button><Button variant="outline" size="sm" onClick={() => adjustRest(15)}><Plus /> 15s</Button><Button variant="secondary" size="sm" onClick={clearRest}>Skip</Button></div></Card>}
    </>;
  }

  function renderActiveExercise(block: Block<SessionExercise>, item: SessionExercise, blockIndex: number, itemIndex: number, isNext: boolean) {
    const name = exerciseById.get(item.exerciseId)?.name ?? "Unknown exercise";
    const completed = item.sets.filter((s) => s.completed).length;
    const prevSets = exerciseSessions(state.workouts, item.exerciseId).at(-1)?.sets ?? [];
    return <div key={item.id} className={cn(itemIndex > 0 && "mt-4 border-t border-border/60 pt-3", item.skipped && "opacity-50")}>
      <div className="mb-2 flex items-center gap-2">{block.kind === "group" && <span className="grid size-6 shrink-0 place-items-center rounded-sm bg-secondary text-[11px] font-bold">{String.fromCharCode(65 + itemIndex)}</span>}<div className="min-w-0 flex-1"><div className="truncate font-bold">{name}</div><div className="text-xs text-muted-foreground">{completed}/{item.sets.length} complete</div></div>{isNext && <span className="rounded-sm bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">NEXT</span>}<SmallButton label={`Skip ${name}`} onClick={() => updateActive((w) => { for (const b of w.blocks) for (const it of b.items) if (it.id === item.id) it.skipped = !it.skipped; })}><SkipForward /></SmallButton><SmallButton label={`Remove ${name}`} onClick={() => updateActive((w) => { w.blocks = normalize(w.blocks.map((b) => ({ ...b, items: b.items.filter((it) => it.id !== item.id) }))); })}><X /></SmallButton></div>
      <div className="grid grid-cols-[1.3rem_1fr_1fr_2.8rem] items-center gap-2 px-1 pb-1 text-[10px] font-semibold uppercase text-muted-foreground"><span>#</span><span>Previous · {state.settings.unit}</span><span>Weight / reps</span><span /></div>
      {item.sets.map((set, si) => {
        const prior = prevSets[si] ?? prevSets.at(-1);
        const prTypes = computePRs([...state.workouts, ...(active ? [active] : [])]).get(set.id);
        const done = set.completed && !set.skipped;
        const skipped = set.skipped;
        return <div key={set.id} className={cn("mb-2 grid grid-cols-[1.3rem_1fr_1fr_2.8rem] items-center gap-2 rounded-md p-1", isNext && nextUp(active ?? { blocks: [], id: "", routineId: null, name: "", startedAt: "", endedAt: null, notes: "", } as Workout)?.setId === set.id && "bg-primary/10", done && "bg-success/10", skipped && "bg-muted/50")}>
          <span className="text-xs font-semibold text-muted-foreground">{si + 1}</span>
          <span className="text-xs text-muted-foreground">{prior ? `${fmtNum(prior.weight)} × ${prior.reps}` : "—"}</span>
          <div className="min-w-0"><Stepper value={set.weight} onChange={(v) => editActiveSet(item.id, set.id, "weight", v)} step={state.settings.unit === "kg" ? 2.5 : 5} decimal label={`${name} set ${si + 1} weight`} placeholder={state.settings.unit} /><div className="mt-1"><Stepper value={set.reps} onChange={(v) => editActiveSet(item.id, set.id, "reps", v)} step={1} label={`${name} set ${si + 1} reps`} placeholder="reps" /></div></div>
          <div className="flex flex-col items-center gap-1">{prTypes?.length ? <Trophy className="size-4 text-pr" aria-label="Personal record" /> : null}<Button size="icon-sm" variant={done ? "default" : skipped ? "secondary" : "outline"} aria-label={done ? "Reopen set" : skipped ? "Unskip set" : `Complete set ${si + 1}`} onClick={() => closeSet(item.id, set.id, done ? "reopen" : skipped ? "reopen" : "complete")}><Check /></Button><Button size="icon-sm" variant="ghost" aria-label={`Skip set ${si + 1}`} onClick={() => closeSet(item.id, set.id, skipped ? "reopen" : "skip")}><SkipForward /></Button></div>
        </div>;
      })}
      <div className="flex items-center justify-between"><RestSelect value={block.restSeconds} onChange={(value) => updateActive((w) => { const b = w.blocks.find((x) => x.id === block.id); if (b) b.restSeconds = value; })} defaultSeconds={state.settings.restSeconds} className="h-9"/><Button variant="ghost" size="sm" onClick={() => addActiveSet(item.id)}><Plus /> Add set</Button></div>
    </div>;
  }

  function renderSummary() {
    if (!summaryWorkout) return <><PageHeader title="Workout summary"/><EmptyState icon={<Check />} title="Session saved" text="Your workout is now in your training history." action={<Button onClick={() => openView("history")}>View history</Button>} /></>;
    const prs = computePRs([...state.workouts.filter((w) => w.id !== summaryWorkout.id), summaryWorkout]);
    const volume = workoutVolume(summaryWorkout);
    const allDone = doneSets(summaryWorkout);
    const newRecords = allDone.filter(({ set }) => prs.has(set.id));
    return <>
      <PageHeader title="Workout saved" subtitle={fmtDate(summaryWorkout.startedAt)} actions={renderHeaderAction()} />
      <div className="mb-5 grid grid-cols-2 gap-3"><Stat label="Duration" value={fmtDuration(workoutDuration(summaryWorkout))}/><Stat label="Volume" value={`${fmtVolume(volume)} ${state.settings.unit}`}/><Stat label="Sets logged" value={allDone.length}/><Stat label="Records" value={newRecords.length}/></div>
      {newRecords.length > 0 && <Card className="mb-5 border-pr/40 p-4"><SectionLabel><Trophy className="mr-2 inline size-4 text-pr"/> New records</SectionLabel>{newRecords.map(({ exerciseId: exId, set }) => <div key={set.id} className="flex justify-between border-t py-2 text-sm"><span>{exerciseById.get(exId)?.name ?? "Exercise"}</span><strong>{fmtNum(set.weight)} {state.settings.unit} × {set.reps}</strong></div>)}</Card>}
      <SectionLabel>Session details</SectionLabel><div className="space-y-2">{summaryWorkout.blocks.flatMap((b) => b.items.map((it) => <Card key={it.id} className="p-3"><div className="font-semibold">{exerciseById.get(it.exerciseId)?.name ?? "Exercise"}</div><div className="mt-1 text-sm text-muted-foreground">{it.sets.filter((s) => s.completed && !s.skipped).map((s, i) => `Set ${i + 1}: ${fmtNum(s.weight)} × ${s.reps}`).join(" · ") || "No completed sets"}</div></Card>))}</div>
      {summaryWorkout.notes && <Card className="mt-4 p-4"><div className="text-xs font-semibold uppercase text-muted-foreground">Notes</div><p className="mt-1">{summaryWorkout.notes}</p></Card>}
      <div className="mt-5 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => openView("home")}>Home</Button><Button onClick={() => openView("history")}>Workout history</Button></div>
    </>;
  }

  function renderProgress() {
    if (selectedExercise) return renderExerciseProgress(selectedExercise);
    const exercises = state.exercises.filter((e) => !e.archived && e.name.toLowerCase().includes(exerciseSearch.toLowerCase()));
    return <>
      <PageHeader title="Progress" subtitle="Your strength, one session at a time." actions={renderHeaderAction()} />
      <Input value={exerciseSearch} onChange={(e) => setExerciseSearch(e.target.value)} placeholder="Find an exercise" aria-label="Search progress exercises" className="mb-4 h-12" />
      {exercises.length ? <div className="space-y-1">{exercises.map((e) => {
        const sessions = exerciseSessions(state.workouts, e.id); const trend = trendStatus(sessions);
        return <button key={e.id} type="button" onClick={() => setExerciseId(e.id)} className="flex min-h-16 w-full items-center gap-3 border-b px-1 py-2 text-left"><div className="grid size-10 place-items-center rounded-md bg-secondary text-primary"><Dumbbell className="size-4"/></div><div className="min-w-0 flex-1"><div className="truncate font-semibold">{e.name}</div><div className="text-xs text-muted-foreground">{sessions.length} {sessions.length === 1 ? "session" : "sessions"}{sessions.at(-1) ? ` · Best ${fmtNum(sessions.at(-1)?.bestSet.weight)} × ${sessions.at(-1)?.bestSet.reps}` : " · No logged sets"}</div></div><StatusBadge status={trend.status} change={trend.change}/></button>;
      })}</div> : <EmptyState icon={<BarChart3 />} title="No exercises found" text="Search by exercise name or log a workout to see your progress." />}
    </>;
  }

  function renderExerciseProgress(e: Exercise) {
    const sessions = exerciseSessions(state.workouts, e.id);
    const records = exerciseRecords(sessions);
    const trend = trendStatus(sessions);
    const filtered = sessions.filter((s) => range === "all" || new Date(s.date).getTime() >= now - Number(range) * 86400000);
    const chartData = filtered.map((s) => ({ date: fmtShortDate(s.date), weight: s.topWeight, e1rm: Math.round(s.best1rm * 10) / 10, volume: s.volume }));
    const monthEntry = sessions.filter((s) => new Date(s.date).getMonth() === new Date().getMonth() && new Date(s.date).getFullYear() === new Date().getFullYear()).at(-1);
    const value = metric === "weight" ? "weight" : metric;
    return <>
      <div className="mb-4 flex items-center gap-2"><Button variant="ghost" size="icon" aria-label="Back to progress" onClick={() => setExerciseId(null)}><ArrowLeft /></Button><div className="min-w-0 flex-1"><h1 className="truncate text-2xl font-bold">{e.name}</h1><div className="text-sm text-muted-foreground">{e.muscle} · {e.equipment}</div></div></div>
      <div className="mb-4 flex items-center justify-between"><StatusBadge status={trend.status} change={trend.change}/><span className="text-sm text-muted-foreground">{sessions.length} sessions</span></div>
      {records ? <div className="mb-5 grid grid-cols-2 gap-3"><Stat label="Heaviest" value={`${fmtNum(records.heaviest.weight)} ${state.settings.unit}`} sub={`${records.heaviest.reps} reps`}/><Stat label="Best est. 1RM" value={`${fmtNum(Math.round(records.best1rm.value * 10) / 10)} ${state.settings.unit}`} sub={`${fmtNum(records.best1rm.weight)} × ${records.best1rm.reps}`}/><Stat label="Best set volume" value={fmtVolume(records.bestVolume.value)} sub={`${records.bestVolume.weight} × ${records.bestVolume.reps}`}/><Stat label="Best reps at weight" value={records.repsAtWeight.length ? `${records.repsAtWeight[0]?.reps} reps` : "—"} sub={records.repsAtWeight.length ? `at ${records.repsAtWeight[0]?.weight} ${state.settings.unit}` : undefined}/></div> : <EmptyState icon={<Activity />} title="No training data yet" text="Complete this exercise in a workout and your progress will appear here."/>}
      <Card className="mb-5 p-4"><SectionLabel>Strength over time</SectionLabel><div className="mb-3 flex gap-2"><Select value={metric} onValueChange={(x) => setMetric(x as ChartMetric)}><SelectTrigger className="h-10 flex-1" aria-label="Progress metric"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="e1rm">Est. 1RM</SelectItem><SelectItem value="weight">Top weight</SelectItem><SelectItem value="volume">Session volume</SelectItem></SelectContent></Select><Select value={range} onValueChange={setRange}><SelectTrigger className="h-10 w-32" aria-label="Chart time range"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All time</SelectItem><SelectItem value="90">3 months</SelectItem><SelectItem value="180">6 months</SelectItem><SelectItem value="365">1 year</SelectItem></SelectContent></Select></div>
        {chartData.length ? <div className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 4"/><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}/><YAxis width={42} tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}/><Tooltip contentStyle={{ background: "var(--color-popover)", borderColor: "var(--color-border)", borderRadius: 8 }}/><Area dataKey={value} type="monotone" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.15} strokeWidth={2.5}/></AreaChart></ResponsiveContainer></div> : <p className="py-8 text-center text-sm text-muted-foreground">Log a completed set to see your chart.</p>}
      </Card>
      {monthEntry && <Card className="mb-5 p-4"><div className="text-xs font-semibold uppercase text-muted-foreground">This month</div><div className="mt-1 text-lg font-bold">{fmtNum(monthEntry.bestSet.weight)} {state.settings.unit} × {monthEntry.bestSet.reps}</div><div className="text-xs text-muted-foreground">{fmtDate(monthEntry.date)}</div></Card>}
      <SectionLabel>Session history</SectionLabel>
      {sessions.length ? [...sessions].reverse().map((s) => <Card key={s.workoutId} className="mb-2 p-3"><div className="flex items-center justify-between"><div className="font-semibold">{fmtDate(s.date)}</div><div className="text-sm text-muted-foreground">{fmtNum(s.topWeight)} {state.settings.unit} max</div></div><div className="mt-2 flex flex-wrap gap-2">{s.sets.map((set, i) => <span key={`${s.workoutId}-${i}`} className="rounded-sm bg-secondary px-2 py-1 text-xs">{fmtNum(set.weight)} × {set.reps}</span>)}</div></Card>) : <EmptyState icon={<History />} title="No sessions yet" text="Your completed sets will be listed here."/>}
    </>;
  }

  function renderHistory() {
    if (selectedWorkout) return renderWorkoutDetail(selectedWorkout);
    const ordered = [...state.workouts].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return <>
      <PageHeader title="History" subtitle={`${ordered.length} completed ${ordered.length === 1 ? "workout" : "workouts"}`} actions={renderHeaderAction()} />
      {ordered.length ? <div className="space-y-2">{ordered.map((w) => <button key={w.id} type="button" onClick={() => setWorkoutId(w.id)} className="flex min-h-20 w-full items-center gap-3 border-b py-3 text-left"><div className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-primary"><Dumbbell className="size-4"/></div><div className="min-w-0 flex-1"><div className="truncate font-semibold">{w.name}</div><div className="text-xs text-muted-foreground">{fmtDate(w.startedAt)} · {fmtDuration(workoutDuration(w))}</div></div><div className="shrink-0 text-right"><div className="font-semibold">{fmtVolume(workoutVolume(w))}</div><div className="text-[11px] text-muted-foreground">{state.settings.unit} volume</div></div><ChevronRight className="size-4 text-muted-foreground"/></button>)}</div> : <EmptyState icon={<History />} title="No workouts yet" text="Finish your first session and your training history will be saved here." action={<Button onClick={() => openView("start")}>Start a workout</Button>}/>}
    </>;
  }

  function renderWorkoutDetail(w: Workout) {
    const setCount = doneSets(w).length;
    const toLocalDate = dateKey(w.startedAt);
    return <>
      <div className="mb-4 flex items-center gap-2"><Button variant="ghost" size="icon" aria-label="Back to history" onClick={() => setWorkoutId(null)}><ArrowLeft/></Button><div className="min-w-0 flex-1"><Input aria-label="Workout title" value={w.name} onChange={(e) => updateWorkout(w.id, (item) => { item.name = e.target.value; })} className="h-10 border-0 px-0 text-xl font-bold focus-visible:ring-0"/><div className="text-xs text-muted-foreground">{setCount} completed sets · {fmtVolume(workoutVolume(w))} {state.settings.unit}</div></div><Button variant="destructive" size="icon" aria-label="Delete workout" onClick={() => deleteWorkoutWithConfirm(w.id)}><Trash2/></Button></div>
      <Card className="mb-4 p-3"><label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Date</label><Input aria-label="Workout date" type="date" value={toLocalDate} onChange={(e) => { if (e.target.value) updateWorkout(w.id, (item) => { const old = new Date(item.startedAt); item.startedAt = new Date(`${e.target.value}T${String(old.getHours()).padStart(2, "0")}:${String(old.getMinutes()).padStart(2, "0")}:00`).toISOString(); }); }}/><label className="mb-1 mt-3 block text-xs font-semibold uppercase text-muted-foreground">Notes</label><Textarea aria-label="Edit workout notes" value={w.notes} onChange={(e) => updateWorkout(w.id, (item) => { item.notes = e.target.value; })}/></Card>
      <SectionLabel>Exercises and sets</SectionLabel>
      <div className="space-y-3">{w.blocks.map((block) => <Card key={block.id} className={cn("p-3", block.kind === "group" && "border-l-4 border-l-primary")}>
        {block.kind === "group" && <div className="mb-2 text-xs font-bold uppercase text-primary">{block.name}</div>}
        {block.items.map((item, ei) => <div key={item.id} className={cn(ei > 0 && "mt-3 border-t pt-3")}><div className="mb-2 font-semibold">{exerciseById.get(item.exerciseId)?.name ?? "Exercise"}{item.skipped && <span className="ml-2 text-xs text-muted-foreground">Skipped</span>}</div>
          {item.sets.map((set, si) => <div key={set.id} className="mb-2 grid grid-cols-[2rem_1fr_1fr_2.8rem] items-center gap-2"><span className="text-xs text-muted-foreground">{si + 1}</span><Stepper value={set.weight} onChange={(v) => updateWorkout(w.id, (x) => { const it = x.blocks.flatMap((b) => b.items).find((a) => a.id === item.id); const s = it?.sets.find((a) => a.id === set.id); if (s) s.weight = v; })} step={2.5} decimal label={`History ${item.id} set ${si + 1} weight`}/><Stepper value={set.reps} onChange={(v) => updateWorkout(w.id, (x) => { const it = x.blocks.flatMap((b) => b.items).find((a) => a.id === item.id); const s = it?.sets.find((a) => a.id === set.id); if (s) s.reps = v; })} step={1} label={`History ${item.id} set ${si + 1} reps`}/><SmallButton label={`Delete set ${si + 1}`} onClick={() => updateWorkout(w.id, (x) => { const it = x.blocks.flatMap((b) => b.items).find((a) => a.id === item.id); if (it) it.sets = it.sets.filter((s) => s.id !== set.id); })}><Trash2/></SmallButton></div>)}
          <Button variant="ghost" size="sm" onClick={() => updateWorkout(w.id, (x) => { const it = x.blocks.flatMap((b) => b.items).find((a) => a.id === item.id); const last = it?.sets.at(-1); if (it) it.sets.push({ id: crypto.randomUUID(), weight: last?.weight ?? null, reps: last?.reps ?? null, completed: true, skipped: false }); })}><Plus/> Add set</Button>
        </div>)}
      </Card>)}</div>
    </>;
  }

  function renderExercises() {
    const list = visibleExercises();
    return <>
      <PageHeader title="Exercises" subtitle={`${state.exercises.filter((e) => !e.archived).length} in your library`} actions={<Button variant="ghost" size="icon" aria-label="Settings" onClick={() => openView("settings")}><Settings2/></Button>}/>
      <div className="mb-3 flex gap-2"><Input value={exerciseSearch} onChange={(e) => setExerciseSearch(e.target.value)} placeholder="Search exercises" aria-label="Search exercises" className="h-11 flex-1"/><Button onClick={() => openCustom()}><Plus/> Add</Button></div>
      <div className="mb-4 grid grid-cols-2 gap-2"><Select value={exerciseMuscle} onValueChange={setExerciseMuscle}><SelectTrigger aria-label="Filter by muscle group" className="h-10"><SelectValue placeholder="All muscles"/></SelectTrigger><SelectContent><SelectItem value="all">All muscles</SelectItem>{MUSCLE_GROUPS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><Select value={exerciseEquipment} onValueChange={setExerciseEquipment}><SelectTrigger aria-label="Filter by equipment" className="h-10"><SelectValue placeholder="All equipment"/></SelectTrigger><SelectContent><SelectItem value="all">All equipment</SelectItem>{EQUIPMENT.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
      {list.length ? <div className="space-y-1">{list.map((e) => <div key={e.id} className="flex min-h-16 items-center gap-3 border-b py-2"><button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setExerciseId(e.id); openView("progress"); }}><span className="block truncate font-semibold">{e.name}</span><span className="text-xs text-muted-foreground">{e.muscle} · {e.equipment}</span></button>{e.custom && <><Button variant="ghost" size="icon-sm" aria-label={`Edit ${e.name}`} onClick={() => openCustom(e)}><Pencil/></Button><Button variant="ghost" size="icon-sm" aria-label={`Archive ${e.name}`} onClick={() => updateExercise(e.id, { archived: true })}><MoreHorizontal/></Button></>}</div>)}</div> : <EmptyState icon={<Dumbbell/>} title="No exercises match" text="Try another search or add a custom exercise." action={<Button onClick={() => openCustom()}>Add exercise</Button>}/>}
    </>;
  }

  function renderSettings() {
    return <>
      <PageHeader title="Settings" subtitle="Your preferences and data." />
      <Card className="mb-4 p-4"><SectionLabel>Workout defaults</SectionLabel><div className="flex items-center justify-between border-t py-3"><div><div className="font-semibold">Default rest</div><div className="text-xs text-muted-foreground">Used after each completed set</div></div><RestSelect value={state.settings.restSeconds} onChange={(v) => updateSettings({ restSeconds: v ?? 90 })} defaultSeconds={state.settings.restSeconds}/></div><div className="flex items-center justify-between border-t py-3"><div><div className="font-semibold">Weight unit</div><div className="text-xs text-muted-foreground">Used for new entries and totals</div></div><Select value={state.settings.unit} onValueChange={(unit) => updateSettings({ unit: unit as "kg" | "lb" })}><SelectTrigger aria-label="Weight unit" className="w-28"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="kg">Kilograms</SelectItem><SelectItem value="lb">Pounds</SelectItem></SelectContent></Select></div><div className="flex items-center justify-between border-t py-3"><div><div className="font-semibold">Timer sound</div><div className="text-xs text-muted-foreground">A short tone when rest ends</div></div><Button variant={state.settings.sound ? "default" : "outline"} onClick={() => updateSettings({ sound: !state.settings.sound })}>{state.settings.sound ? "On" : "Off"}</Button></div><div className="flex items-center justify-between border-t py-3"><div><div className="font-semibold">Vibration</div><div className="text-xs text-muted-foreground">Vibrate when rest ends</div></div><Button variant={state.settings.vibrate ? "default" : "outline"} onClick={() => updateSettings({ vibrate: !state.settings.vibrate })}>{state.settings.vibrate ? "On" : "Off"}</Button></div></Card>
      <Card className="mb-4 p-4"><SectionLabel>Backup and restore</SectionLabel><p className="mb-3 text-sm text-muted-foreground">Keep a copy of your routines, exercises, settings, and workout history.</p><div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" onClick={() => downloadFile("gymlog-backup.json", exportJSON(), "application/json")}><FileDown/> Download JSON backup</Button><Button variant="outline" onClick={() => fileInput.current?.click()}><FileUp/> Import backup</Button><input ref={fileInput} type="file" accept="application/json,.json" className="hidden" aria-label="Choose backup file" onChange={(e) => { importFile(e.target.files?.[0]); e.currentTarget.value = ""; }}/><Button variant="outline" onClick={() => downloadFile("gymlog-history.csv", exportCSV(), "text/csv")}><FileDown/> Export history CSV</Button></div>{importMessage && <p role="status" className="mt-3 text-sm text-primary">{importMessage}</p>}</Card>
      <Card className="p-4"><SectionLabel>Reset</SectionLabel><p className="mb-3 text-sm text-muted-foreground">Restore the original exercise library and example routine. Your workout history will be removed.</p><Button variant="destructive" onClick={() => { if (window.confirm("Reset all GymLog data? Your routines, history, and settings will be replaced.")) { resetAll(); setImportMessage("Your tracker was reset."); } }}><RotateCcw/> Reset all data</Button></Card>
    </>;
  }

  return <div className="min-h-screen bg-background pb-28 text-foreground md:pb-8">
    <div className="mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6 md:pt-8">
      <div className="mb-6 hidden items-center justify-between border-b pb-4 md:flex"><button type="button" onClick={() => openView("home")} className="flex items-center gap-2 text-left"><span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground"><Dumbbell className="size-5"/></span><span className="font-display text-2xl font-bold uppercase">GymLog</span></button><nav className="flex gap-1">{NAV_ITEMS.map(({ id, label, icon: Icon }) => <Button key={id} variant={view === id ? "secondary" : "ghost"} onClick={() => id === "start" && active ? openView("start") : openView(id)}><Icon/>{label}</Button>)}<Button variant={view === "exercises" ? "secondary" : "ghost"} onClick={() => openView("exercises")}><Dumbbell/>Exercises</Button><Button variant={view === "settings" ? "secondary" : "ghost"} onClick={() => openView("settings")}><Settings2/>Settings</Button></nav></div>
      <main>{view === "home" ? renderHome() : view === "workouts" ? renderWorkouts() : view === "start" ? renderStart() : view === "progress" ? renderProgress() : view === "history" ? renderHistory() : view === "exercises" ? renderExercises() : view === "settings" ? renderSettings() : renderSummary()}</main>
    </div>
    <nav aria-label="Main navigation" className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-2 pt-2 backdrop-blur md:hidden"><div className="mx-auto flex max-w-lg items-end justify-around">{NAV_ITEMS.map(({ id, label, icon: Icon }) => <Button key={id} variant="ghost" className={cn("h-14 min-w-0 flex-1 flex-col gap-0.5 rounded-none px-1 text-[10px]", view === id && "text-primary", id === "start" && "-mt-5 h-[4.25rem] max-w-[4.25rem] rounded-full border-4 border-background bg-primary text-primary-foreground shadow-lg hover:bg-primary/90")} onClick={() => id === "start" && active ? openView("start") : openView(id)} aria-current={view === id ? "page" : undefined}><Icon className="size-5"/><span>{label}</span></Button>)}</div></nav>
    {customOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setCustomOpen(false); }}><form onSubmit={saveCustomExercise} className="w-full max-w-md rounded-t-lg border bg-card p-5 sm:rounded-lg"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-bold">{editingExercise ? "Edit exercise" : "New exercise"}</h2><p className="text-sm text-muted-foreground">Add a movement to your library.</p></div><Button type="button" size="icon" variant="ghost" aria-label="Close" onClick={() => setCustomOpen(false)}><X/></Button></div><label className="mb-1 block text-sm font-medium">Exercise name</label><Input required autoFocus value={customName} onChange={(e) => setCustomName(e.target.value)} className="mb-3 h-12"/><label className="mb-1 block text-sm font-medium">Muscle group</label><Select value={customMuscle} onValueChange={(x) => setCustomMuscle(x as MuscleGroup)}><SelectTrigger className="mb-3 h-12"><SelectValue/></SelectTrigger><SelectContent>{MUSCLE_GROUPS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><label className="mb-1 block text-sm font-medium">Equipment</label><Select value={customEquipment} onValueChange={(x) => setCustomEquipment(x as Equipment)}><SelectTrigger className="h-12"><SelectValue/></SelectTrigger><SelectContent>{EQUIPMENT.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select><div className="mt-5 flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={() => setCustomOpen(false)}>Cancel</Button><Button type="submit" className="flex-1">{editingExercise ? "Save changes" : "Add exercise"}</Button></div></form></div>}
  </div>;
}