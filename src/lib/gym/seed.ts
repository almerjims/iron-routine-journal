import type { Equipment, Exercise, MuscleGroup, Routine } from "./types";

const list: [string, MuscleGroup, Equipment][] = [
  ["Bench Press", "Chest", "Barbell"],
  ["Incline Bench Press", "Chest", "Barbell"],
  ["Incline Dumbbell Press", "Chest", "Dumbbell"],
  ["Dumbbell Bench Press", "Chest", "Dumbbell"],
  ["Dumbbell Fly", "Chest", "Dumbbell"],
  ["Cable Crossover", "Chest", "Cable"],
  ["Machine Chest Press", "Chest", "Machine"],
  ["Pec Deck", "Chest", "Machine"],
  ["Push-Up", "Chest", "Bodyweight"],
  ["Chest Dip", "Chest", "Bodyweight"],
  ["Deadlift", "Back", "Barbell"],
  ["Lat Pulldown", "Back", "Cable"],
  ["Seated Cable Row", "Back", "Cable"],
  ["Pull-Up", "Back", "Bodyweight"],
  ["Chin-Up", "Back", "Bodyweight"],
  ["Barbell Row", "Back", "Barbell"],
  ["Dumbbell Row", "Back", "Dumbbell"],
  ["T-Bar Row", "Back", "Barbell"],
  ["Machine Row", "Back", "Machine"],
  ["Straight-Arm Pulldown", "Back", "Cable"],
  ["Overhead Press", "Shoulders", "Barbell"],
  ["Dumbbell Shoulder Press", "Shoulders", "Dumbbell"],
  ["Arnold Press", "Shoulders", "Dumbbell"],
  ["Lateral Raise", "Shoulders", "Dumbbell"],
  ["Cable Lateral Raise", "Shoulders", "Cable"],
  ["Face Pull", "Shoulders", "Cable"],
  ["Rear Delt Fly", "Shoulders", "Dumbbell"],
  ["Upright Row", "Shoulders", "Barbell"],
  ["Bicep Curl", "Biceps", "Dumbbell"],
  ["Barbell Curl", "Biceps", "Barbell"],
  ["Hammer Curl", "Biceps", "Dumbbell"],
  ["Preacher Curl", "Biceps", "Machine"],
  ["Cable Curl", "Biceps", "Cable"],
  ["Incline Dumbbell Curl", "Biceps", "Dumbbell"],
  ["Tricep Pushdown", "Triceps", "Cable"],
  ["Overhead Tricep Extension", "Triceps", "Cable"],
  ["Skull Crusher", "Triceps", "Barbell"],
  ["Close-Grip Bench Press", "Triceps", "Barbell"],
  ["Tricep Dip", "Triceps", "Bodyweight"],
  ["Squat", "Quads", "Barbell"],
  ["Front Squat", "Quads", "Barbell"],
  ["Leg Press", "Quads", "Machine"],
  ["Hack Squat", "Quads", "Machine"],
  ["Leg Extension", "Quads", "Machine"],
  ["Bulgarian Split Squat", "Quads", "Dumbbell"],
  ["Goblet Squat", "Quads", "Dumbbell"],
  ["Walking Lunge", "Quads", "Dumbbell"],
  ["Romanian Deadlift", "Hamstrings", "Barbell"],
  ["Leg Curl", "Hamstrings", "Machine"],
  ["Seated Leg Curl", "Hamstrings", "Machine"],
  ["Good Morning", "Hamstrings", "Barbell"],
  ["Hip Thrust", "Glutes", "Barbell"],
  ["Glute Bridge", "Glutes", "Bodyweight"],
  ["Cable Kickback", "Glutes", "Cable"],
  ["Hip Abduction", "Glutes", "Machine"],
  ["Calf Raise", "Calves", "Machine"],
  ["Seated Calf Raise", "Calves", "Machine"],
  ["Plank", "Core", "Bodyweight"],
  ["Hanging Leg Raise", "Core", "Bodyweight"],
  ["Cable Crunch", "Core", "Cable"],
  ["Ab Wheel Rollout", "Core", "Other"],
  ["Russian Twist", "Core", "Bodyweight"],
  ["Shrug", "Other", "Dumbbell"],
  ["Farmer's Carry", "Other", "Dumbbell"],
  ["Kettlebell Swing", "Other", "Kettlebell"],
];

export const exId = (name: string) =>
  "ex-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function seedExercises(): Exercise[] {
  return list.map(([name, muscle, equipment]) => ({
    id: exId(name), name, muscle, equipment, custom: false, archived: false,
  }));
}

export function seedRoutine(now: string): Routine {
  const p: [string, number, number, number][] = [
    ["Bench Press", 3, 6, 8],
    ["Incline Dumbbell Press", 3, 8, 12],
    ["Lat Pulldown", 3, 10, 12],
    ["Cable Lateral Raise", 3, 12, 15],
    ["Tricep Pushdown", 3, 10, 12],
    ["Bicep Curl", 3, 10, 12],
  ];
  return {
    id: "rt-upper-body",
    name: "Upper Body",
    createdAt: now,
    updatedAt: now,
    blocks: p.map(([n, sets, repMin, repMax], i) => ({
      id: `rt-upper-b${i}`,
      kind: "single",
      name: "",
      restSeconds: null,
      items: [{ id: `rt-upper-p${i}`, exerciseId: exId(n), sets, repMin, repMax }],
    })),
  };
}
