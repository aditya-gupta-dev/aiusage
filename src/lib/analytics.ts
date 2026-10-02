import type { UsageEvent } from "./types";
export const agents: Record<string, string> = {
  claude: "Claude Code",
  codex: "Codex",
  gemini: "Gemini CLI",
  opencode: "OpenCode",
  amp: "Amp",
  droid: "Droid",
  codebuff: "Codebuff",
  hermes: "Hermes",
  pi: "Pi",
  goose: "Goose",
  kilo: "Kilo Code",
  copilot: "GitHub Copilot",
  antigravity: "Antigravity",
  kimi: "Kimi",
  qwen: "Qwen Code",
  openclaw: "OpenClaw",
  grok: "Grok Build",
  zcode: "ZCode",
};
export const colors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
export const compact = (n: number) =>
  Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
export const money = (n: number) =>
  Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
export const localDay = (v: string | Date) => {
  const d = new Date(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const total = (rows: UsageEvent[]) =>
  rows.reduce(
    (a, e) => ({
      tokens: a.tokens + e.total,
      input: a.input + e.input,
      output: a.output + e.output,
      cacheRead: a.cacheRead + e.cacheRead,
      cacheWrite: a.cacheWrite + e.cacheWrite,
      cost: a.cost + (e.cost ?? 0),
      unknown: a.unknown + (e.cost === null ? 1 : 0),
      reasoning: a.reasoning + e.reasoning,
    }),
    {
      tokens: 0,
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0,
      unknown: 0,
      reasoning: 0,
    },
  );
export function groups(
  rows: UsageEvent[],
  key: "model" | "agent" | "session" | "project",
) {
  const map = new Map<string, UsageEvent[]>();
  for (const e of rows) {
    const k =
      key === "session"
        ? `${e.agent}:${e.session}`
        : e[key] || "Unknown project";
    const bucket = map.get(k);
    if (bucket) bucket.push(e);
    else map.set(k, [e]);
  }
  return [...map.entries()]
    .map(([key, events], i) => ({
      key,
      name: key,
      events,
      ...total(events),
      requests: events.length,
      sessions: new Set(events.map((e) => `${e.agent}:${e.session}`)).size,
      fill: colors[i % colors.length],
    }))
    .sort((a, b) => b.tokens - a.tokens);
}
export function daily(rows: UsageEvent[], start: string, end: string) {
  const map = new Map<string, Record<string, number | string>>();
  let d = new Date(start + "T12:00:00");
  const until = new Date(end + "T12:00:00");
  while (d <= until) {
    map.set(localDay(d), {
      date: localDay(d),
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      tokens: 0,
      cost: 0,
      claude: 0,
      codex: 0,
      gemini: 0,
      opencode: 0,
    });
    d.setDate(d.getDate() + 1);
  }
  for (const e of rows) {
    const day = map.get(localDay(e.timestamp));
    if (!day) continue;
    for (const k of ["input", "output", "cacheRead", "cacheWrite"] as const)
      day[k] = Number(day[k]) + e[k];
    day.tokens = Number(day.tokens) + e.total;
    day.cost = Number(day.cost) + (e.cost ?? 0);
    day[e.agent] = Number(day[e.agent]) + e.total;
  }
  return [...map.values()];
}
