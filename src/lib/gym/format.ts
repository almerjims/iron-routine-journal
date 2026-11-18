import { format } from "date-fns";

export const fmtNum = (n: number | null | undefined) =>
  n == null ? "–" : Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);

const pad = (n: number) => String(n).padStart(2, "0");

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function fmtDuration(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

export function fmtVolume(v: number) {
  return v >= 10000 ? `${(v / 1000).toFixed(1)}k` : fmtNum(Math.round(v));
}

export const fmtDate = (iso: string) => format(new Date(iso), "EEE, MMM d, yyyy");
export const fmtShortDate = (iso: string) => format(new Date(iso), "MMM d");

export function workoutDuration(w: { startedAt: string; endedAt: string | null }) {
  const end = w.endedAt ? new Date(w.endedAt).getTime() : Date.now();
  return end - new Date(w.startedAt).getTime();
}
