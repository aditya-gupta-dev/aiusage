import type { AgentId, UsageEvent } from "../src/lib/types";
import pricing from "./pricing.json";
type RecordValue = Record<string, any>;
const n = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0;
export function price(
  model: string,
  input: number,
  output: number,
  read: number,
  write: number,
): number | null {
  const map = pricing as Record<
    string,
    {
      cost?: {
        input?: number;
        output?: number;
        cache_read?: number;
        cache_write?: number;
      };
    }
  >;
  const key = model.replace(/^(anthropic|openai|google)\//, "");
  const p = map[key]?.cost ?? map[key.replace(/-\d{8}$/, "")]?.cost;
  if (
    !p ||
    p.input === undefined ||
    p.output === undefined ||
    (read > 0 && p.cache_read === undefined) ||
    (write > 0 && p.cache_write === undefined)
  )
    return null;
  return (
    (input * p.input +
      output * p.output +
      read * (p.cache_read ?? 0) +
      write * (p.cache_write ?? 0)) /
    1e6
  );
}
export function parseRecords(
  agent: AgentId,
  rows: RecordValue[],
  file: string,
): UsageEvent[] {
  const events: UsageEvent[] = [];
  let model = "unknown";
  let session = file
    .split("/")
    .pop()!
    .replace(/\.jsonl?$/, "");
  let project = "";
  let previous: RecordValue | undefined;
  const seen = new Set<string>();
  function emit(r: RecordValue, usage: RecordValue, meta: RecordValue = {}) {
    let input = 0,
      output = 0,
      cacheRead = 0,
      cacheWrite = 0,
      reasoning = 0;
    if (agent === "claude") {
      input = n(usage.input_tokens);
      output = n(usage.output_tokens);
      cacheRead = n(usage.cache_read_input_tokens);
      cacheWrite = n(usage.cache_creation_input_tokens);
    }
    if (agent === "codex") {
      cacheRead = Math.min(n(usage.cached_input_tokens), n(usage.input_tokens));
      input = n(usage.input_tokens) - cacheRead;
      output = n(usage.output_tokens);
      reasoning = n(usage.reasoning_output_tokens);
    }
    if (agent === "gemini") {
      cacheRead = n(usage.cached ?? usage.cachedContentTokenCount);
      input = Math.max(0, n(usage.input ?? usage.promptTokenCount) - cacheRead);
      reasoning = n(usage.thoughts ?? usage.thoughtsTokenCount);
      output =
        n(usage.output ?? usage.candidatesTokenCount) +
        reasoning +
        n(usage.tool ?? usage.toolUsePromptTokenCount);
    }
    if (agent === "opencode") {
      input = n(usage.input);
      output = n(usage.output);
      reasoning = n(usage.reasoning);
      cacheRead = n(usage.cache?.read);
      cacheWrite = n(usage.cache?.write);
    }
    const total = input + output + cacheRead + cacheWrite;
    if (!total) return;
    const timestamp =
      meta.timestamp ?? r.timestamp ?? r.time?.created ?? r.created_at;
    const time = new Date(timestamp);
    if (!Number.isFinite(time.getTime())) return;
    const eventModel =
      meta.model ??
      r.message?.model ??
      r.modelID ??
      r.model?.id ??
      (typeof r.model === "string" ? r.model : model);
    const eventSession = r.sessionId ?? r.sessionID ?? r.session_id ?? session;
    const id = `${agent}:${eventSession}:${meta.id ?? r.message?.id ?? r.id ?? time.toISOString()}`;
    if (seen.has(id)) return;
    seen.add(id);
    const recorded = r.costUSD ?? r.cost;
    const estimated = price(eventModel, input, output, cacheRead, cacheWrite);
    const cost =
      typeof recorded === "number" && recorded >= 0 ? recorded : estimated;
    events.push({
      id,
      agent,
      model: eventModel,
      session: eventSession,
      project: r.cwd ?? project,
      timestamp: time.toISOString(),
      input,
      output,
      cacheRead,
      cacheWrite,
      reasoning,
      total,
      cost,
      costSource:
        typeof recorded === "number" && recorded >= 0
          ? "recorded"
          : cost === null
            ? "unknown"
            : "estimated",
    });
  }
  for (const r of rows) {
    if (agent === "claude" && r.type === "assistant" && r.message?.usage)
      emit(r, r.message.usage, {
        id: r.requestId ? `${r.message.id}:${r.requestId}` : r.message.id,
      });
    if (agent === "codex") {
      if (r.type === "session_meta") {
        session = r.payload?.id ?? session;
        project = r.payload?.cwd ?? project;
      }
      if (r.type === "turn_context") {
        model = r.payload?.model ?? model;
        project = r.payload?.cwd ?? project;
      }
      if (
        r.type === "event_msg" &&
        r.payload?.type === "token_count" &&
        r.payload.info
      ) {
        const info = r.payload.info;
        const totals = info.total_token_usage;
        const advanced =
          !totals || JSON.stringify(totals) !== JSON.stringify(previous);
        const usage =
          advanced && info.last_token_usage
            ? info.last_token_usage
            : totals
              ? Object.fromEntries(
                  Object.entries(totals).map(([k, v]) => [
                    k,
                    Math.max(0, n(v) - n(previous?.[k])),
                  ]),
                )
              : undefined;
        previous = totals ?? previous;
        if (usage)
          emit(r, usage, { model: r.payload.model ?? info.model ?? model });
      }
    }
    if (agent === "gemini") {
      session = r.sessionId ?? r.session_id ?? session;
      for (const m of r.messages ?? [r])
        if (m.type === "gemini" && m.tokens)
          emit(m, m.tokens, { model: m.model ?? r.model ?? "unknown" });
    }
    if (agent === "opencode" && r.tokens && (!r.role || r.role === "assistant"))
      emit(r, r.tokens);
  }
  return events;
}
