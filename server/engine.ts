import { resolve } from "node:path";
import type { UsageEvent } from "../src/lib/types";
export const agentNames: Record<string, string> = {
  claude: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  gemini: "Gemini CLI",
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
interface ModelRow {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cost: number;
  missingPricing?: boolean;
}
interface ReportRow {
  agent: string;
  period: string;
  totalTokens: number;
  metadata?: {
    lastActivity?: string;
    projectPath?: string;
    cwd?: string;
    reasoningOutputTokens?: number;
  };
  modelBreakdowns: ModelRow[];
  agents?: ReportRow[];
}
export async function report(
  kind: "daily" | "session",
  since?: string,
  until?: string,
): Promise<ReportRow[]> {
  const args = [
    process.execPath,
    resolve("node_modules/ccusage/src/cli.js"),
    kind,
    "--json",
    "--offline",
    "--by-agent",
    "--timezone",
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ];
  if (since) args.push("--since", since);
  if (until) args.push("--until", until);
  const child = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      ...(process.env.AIUSAGE_HOME ? { HOME: process.env.AIUSAGE_HOME } : {}),
    },
  });
  const timer = setTimeout(() => child.kill(), 90_000);
  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (code !== 0) {
      console.error("ccusage failed:", stderr.slice(0, 500));
      throw new Error("ccusage could not read local usage logs");
    }
    const parsed = JSON.parse(stdout);
    return parsed[kind] ?? [];
  } finally {
    clearTimeout(timer);
  }
}
export function normalize(
  rows: ReportRow[],
  kind: "daily" | "session",
): UsageEvent[] {
  const events: UsageEvent[] = [];
  for (const row of rows)
    for (const a of row.agents ?? [row])
      for (const m of a.modelBreakdowns ?? []) {
        const timestamp =
          kind === "daily"
            ? new Date(`${row.period}T12:00:00`).toISOString()
            : a.metadata?.lastActivity;
        if (!timestamp) continue;
        const input = m.inputTokens ?? 0,
          output = m.outputTokens ?? 0,
          cacheRead = m.cacheReadTokens ?? 0,
          cacheWrite = m.cacheCreationTokens ?? 0;
        events.push({
          id: `${kind}:${a.agent}:${row.period}:${m.modelName}`,
          agent: a.agent,
          model: m.modelName,
          session: kind === "session" ? a.period : "",
          project: a.metadata?.projectPath ?? a.metadata?.cwd ?? "",
          timestamp,
          input,
          output,
          cacheRead,
          cacheWrite,
          reasoning:
            kind === "session" ? (a.metadata?.reasoningOutputTokens ?? 0) : 0,
          total: input + output + cacheRead + cacheWrite,
          cost: m.missingPricing ? null : (m.cost ?? null),
          costSource: m.missingPricing ? "unknown" : "estimated",
          unpricedReason: m.missingPricing ? `Model '${m.modelName}' missing pricing in engine` : undefined,
        });
      }
  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
