# Iron Routine Journal

Build a fully functional, mobile-first **Personal Gym Progress Tracker** (workout journal). Priorities: simplicity, usability at the gym (one-handed), and accurate workout tracking. No social features, meal/calorie tracking, or AI coaching. No placeholder buttons — every button, form, graph and interaction must work.

## STACK & STORAGE
- React + TypeScript + Tailwind + shadcn/ui, Recharts for graphs, react-router.
- No login required. Persist everything in the browser (IndexedDB or localStorage behind a clean data-layer/repository module with typed models so it can later be swapped for a cloud DB). Data must survive refresh/close.
- Never overwrite workout records accidentally: every workout has a unique ID; deletes ask for confirmation.
- Include Export (JSON backup download), Import/restore (with confirmation, merge or replace), and CSV export of history in a Settings page.
- Settings: default rest timer duration, unit kg (default), reset data.

## DESIGN
Dark theme by default (black/dark gray, one subtle accent e.g. emerald or electric blue), clear typography, large tap targets (min 48px) and big inputs, minimal animation, uncluttered. Inspired by Hevy and Strong. Bottom navigation bar on mobile with: Home, Workouts, Start (prominent center button), Progress, History. Exercises library reachable from Workouts and Progress (and a tab/link in nav/desktop sidebar). On desktop use a sidebar or centered max-width layout. Use clear icons (lucide-react).

## SECTIONS
1. **Home (Dashboard)** – Answer: "What workout am I doing today?" Show current/next routine with a big Start Workout button (and resume banner if a workout is in progress). Total workouts completed, workouts this week, recent workouts, recent PRs, weekly frequency bar chart (last 8 weeks), simple overall strength trend (e.g., total estimated-1RM index across main lifts, or % of tracked exercises improving). Keep it simple.
2. **Workouts (Routine Builder)** – Create unlimited routines, name them (Upper Body, Push, Pull, Legs…), edit anytime, duplicate, delete, mark one as "current/next". Add/remove/reorder exercises (drag handles AND up/down buttons for mobile), choose from built-in library or create custom exercise inline, set planned sets and target rep range (min–max) per exercise. Seed example routine "Upper Body": Bench Press 3×6–8, Incline Dumbbell Press 3×8–12, Lat Pulldown 3×10–12, Cable Lateral Raise 3×12–15, Tricep Pushdown 3×10–12, Bicep Curl 3×10–12.
3. **Start Workout (Active Session)** – Pick a routine (or empty workout). Per exercise show a set table: Set | Previous (last time's weight × reps for that set) | Weight (kg) | Reps | ✓ Completed. Fast inputs: numeric keypad inputs (inputMode decimal/numeric), +/- steppers (±2.5 kg, ±1 rep), auto-prefill from previous performance, tapping ✓ completes the set and starts rest timer. Edit or delete any set, add extra set, skip a set or skip an exercise, add an exercise mid-workout (from library or custom), remove exercise, reorder. Different weight/reps for every set. Workout timer showing elapsed duration. Auto-save every change continuously so closing the app never loses progress; on reopen show "Resume workout". Finish Workout → summary (duration, volume, sets, new PRs highlighted) → save to history. Discard workout option with confirmation. Optional notes per workout.
   - **Rest timer**: floating/bottom-sheet timer after completing a set (or after a full superset round), customizable duration (default in settings, adjustable ±15s on the fly and per-exercise override), skip button, optional vibration/beep on finish.
4. **Progress** – List/search all exercises; open one to see: history of previous weights & reps by date, PRs (heaviest weight, best reps at each weight, best estimated 1RM, best single-set volume), a Recharts line graph (toggle: top weight / estimated 1RM / volume, time range filter), and a status badge: **Improving / Maintaining / Declining** computed from recent est. 1RM trend (compare last ~3 sessions vs previous ~3, with a ~2% tolerance for "maintaining"). Show monthly progression summary like "March: 60 kg × 8".
5. **History** – All past workouts (newest first) with date, routine name, duration, volume. Open one to review all exercises/sets/weights/reps (supersets shown grouped). Edit any set/weight/reps/notes/date, add/delete sets, delete whole workout (confirm). Edits must recalculate PRs and progress.
6. **Exercises** – Browse/search/filter the library by muscle group (Chest, Back, Shoulders, Biceps, Triceps, Quads, Hamstrings, Glutes, Calves, Core, Other) and equipment. Seed ~60 common exercises (Bench Press, Incline Dumbbell Press, Overhead Press, Lat Pulldown, Seated Cable Row, Pull-Up, Face Pull, Cable Lateral Raise, Tricep Pushdown, Bicep Curl, Squat, Romanian Deadlift, Leg Press, Leg Curl, Leg Extension, Calf Raise, etc.). Add / edit / archive custom exercises. Tapping an exercise opens its progress page.

## SMART FEATURES
- Auto-show last weight × reps per exercise beside current inputs.
- Epley estimated 1RM: weight × (1 + reps/30) (use weight itself for 1 rep).
- Training volume = Σ weight × reps over COMPLETED sets only.
- Highlight new PRs live during the workout (trophy badge on the set) and in the finish summary. PR types: heaviest weight, best reps at a given weight, best est. 1RM.
- Only completed sets count toward history, PRs, volume and progress. Skipped sets are flagged and excluded.
- User has total control: no forced programs.

## SUPERSETS & GROUPING (critical)
**Data model:** A routine (and a workout session) contains an ordered list of "blocks". A block is either a straight-set exercise block or a group block (superset / giant set) containing 2+ exercises. Each exercise inside keeps its OWN set list (weight, reps, completed, skipped). Group has: id, name (user-editable, default "Superset A", "Superset B"… auto-lettered), restSeconds (round rest), exercise order. Performance data is always stored per exercise (exerciseId) — a superset NEVER merges performance data. Each exercise keeps independent history, weights, reps, PRs, 1RM and progression graphs, regardless of grouping. Grouping only affects how it's displayed/performed.

**A. Creating supersets in the Routine Builder**
- Multi-select exercises in a routine (selection mode with checkboxes) → "Group as Superset". Works for 2 exercises (superset) and 3+ (giant set).
- Name the group (e.g., "Superset A", "Chest + Back").
- Add exercises to / remove exercises from a group, reorder exercises within the group, reorder whole groups/blocks among other blocks.
- "Ungroup" converts a superset back into regular straight-set exercises; "Convert to superset" turns regular exercises into a group. Removing exercises until 1 remains auto-ungroups it.
- Multiple supersets allowed per routine/workout. Set planned sets & rep range per exercise in the group; the group's number of rounds = max sets among its exercises (let the user set a single "rounds" value that syncs sets for all exercises, but allow per-exercise overrides).
- Per-group rest between rounds (customizable, optional – can be set to Off).

**B. Superset logging during a workout**
Show grouped exercises together inside ONE card, e.g.:
```
SUPERSET A  · Round 2 of 3
 Exercise 1: Cable Lateral Raise     [●●○ 2/3]
   Set 1: 10 kg × 15  ✓
   Set 2: 10 kg × 12  ✓
   Set 3: 10 kg × 12
 Exercise 2: Face Pull               [●○○ 1/3]
   Set 1: 20 kg × 15  ✓ ...
```
Each set row has its own weight/reps inputs, previous-performance hint, and independent ✓ completion toggle.

**C. Superset behavior**
- Each exercise's sets are completed independently; user may complete them in ANY/alternating order (no forced order).
- Show a clear "NEXT UP" indicator/highlight on the next recommended exercise+set (the exercise with the fewest completed sets in the current round, following group order: A1 → B1 → A2 → B2…). Update dynamically even if the user does things out of order.
- Rest timer: do NOT start a rest timer after each exercise within a superset. Start the optional rest timer only when an entire round is completed (every exercise in the group has completed its set for that round). Uses the group's customizable rest duration (default from settings; can be Off).
- Add extra set/round (adds a set to every exercise in group, or to a single exercise), skip a set or exercise, edit weight/reps anytime, add/remove an exercise in the group mid-workout.
- Auto-save after every change.

**D. Visual design**
Supersets must look clearly different from straight sets: a single grouped card with a colored left/shared border (accent color, different color per group letter if multiple), a bold "SUPERSET A" (or "GIANT SET" label when 3+ exercises) badge with custom name, exercises nested inside with connector line, per-exercise completion progress chips (e.g., 2/3), a highlighted "NEXT" marker, a check/complete state when all done. Straight-set exercises use plain cards.

**History/Progress with supersets:** History shows supersets grouped as they were performed; Progress, PRs, and graphs treat every exercise individually (a superset exercise's data appears in its own exercise progress page exactly like a straight-set one).

## QUALITY CHECKLIST (test before finishing)
1. Create a custom routine; add/remove/reorder exercises; edit later.
2. Create a 2-exercise superset and a 3-exercise giant set in one routine; ungroup and regroup; rename.
3. Run a workout: record different weights/reps per set across straight sets and supersets, alternate between superset exercises, confirm NEXT UP marker and round-based rest timer behave correctly.
4. Add extra set, skip set/exercise, add exercise mid-workout.
5. Refresh/close mid-workout → resume works with all data intact.
6. Finish → saved in History; open, edit, delete it (with confirmation).
7. Verify PR detection, est. 1RM, volume, Improving/Maintaining/Declining status and charts are correct, and that superset exercises have separate histories/PRs/graphs.
8. Verify mobile layout (375px width), bottom nav, large touch targets, empty states (friendly empty states on every page), and export/import backup round-trip.
Seed demo data only for the exercise library and one example routine — do not fake workout history (empty states instead).

FINAL GOAL: make it extremely easy to answer (1) What workout am I doing today? (2) How much weight and how many reps did I lift? (3) Am I getting stronger compared to previous workouts? Build a polished, reliable, genuinely usable app.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ea80b689-e635-40bd-a3dd-54a9d8ab2ca9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
