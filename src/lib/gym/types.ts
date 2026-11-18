export const MUSCLE_GROUPS = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Quads",
  "Hamstrings", "Glutes", "Calves", "Core", "Other",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = [
  "Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight", "Kettlebell", "Band", "Other",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export interface Exercise {
  id: string;
  name: string;
  muscle: MuscleGroup;
  equipment: Equipment;
  custom: boolean;
  archived: boolean;
}

/** Exercise planned inside a routine. */
export interface PlannedExercise {
  id: string;
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
}

export interface SetEntry {
  id: string;
  weight: number | null;
  reps: number | null;
  completed: boolean;
  skipped: boolean;
}

/** Exercise performed inside a workout. Performance is always stored per exercise. */
export interface SessionExercise {
  id: string;
  exerciseId: string;
  sets: SetEntry[];
  skipped: boolean;
  repMin?: number | undefined;
  repMax?: number | undefined;
}

/**
 * A block is either a straight-set exercise (kind "single", exactly one item)
 * or a superset / giant set (kind "group", 2+ items).
 * restSeconds: null = use default from settings, 0 = off.
 */
export interface Block<T> {
  id: string;
  kind: "single" | "group";
  name: string;
  restSeconds: number | null;
  items: T[];
}

export interface Routine {
  id: string;
  name: string;
  blocks: Block<PlannedExercise>[];
  createdAt: string;
  updatedAt: string;
}

export interface Workout {
  id: string;
  routineId: string | null;
  name: string;
  startedAt: string;
  endedAt: string | null;
  notes: string;
  blocks: Block<SessionExercise>[];
}

export interface Settings {
  restSeconds: number;
  unit: "kg" | "lb";
  sound: boolean;
  vibrate: boolean;
}

export interface RestTimer {
  endsAt: number;
  duration: number;
  label: string;
}

export interface AppState {
  version: 1;
  loaded: boolean;
  exercises: Exercise[];
  routines: Routine[];
  currentRoutineId: string | null;
  workouts: Workout[];
  active: Workout | null;
  settings: Settings;
  rest: RestTimer | null;
}
