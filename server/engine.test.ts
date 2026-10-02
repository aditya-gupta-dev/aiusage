import { describe, expect, test } from "bun:test";
import { normalize } from "./engine";
import { parseRecords } from "./parsers";
describe("canonical report normalization", () => {
  test("keeps agent and model attribution and marks unknown prices", () => {
    const events = normalize(
      [
        {
          agent: "all",
          period: "2026-10-01",
          totalTokens: 160,
          modelBreakdowns: [],
          agents: [
            {
              agent: "antigravity",
              period: "2026-10-01",
              totalTokens: 160,
              modelBreakdowns: [
                {
                  modelName: "unknown-model",
                  inputTokens: 100,
                  outputTokens: 20,
                  cacheReadTokens: 30,
                  cacheCreationTokens: 10,
                  cost: 0,
                  missingPricing: true,
                },
              ],
            },
          ],
        },
      ],
      "daily",
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      agent: "antigravity",
      model: "unknown-model",
      total: 160,
      cost: null,
      session: "",
    });
  });
  test("preserves session attribution and actual last activity", () => {
    const events = normalize(
      [
        {
          agent: "codex",
          period: "session-1",
          totalTokens: 130,
          metadata: { lastActivity: "2026-10-01T10:30:00Z" },
          modelBreakdowns: [
            {
              modelName: "gpt-5.4",
              inputTokens: 100,
              outputTokens: 20,
              cacheReadTokens: 10,
              cacheCreationTokens: 0,
              cost: 0.01,
            },
          ],
        },
      ],
      "session",
    );
    expect(events[0]).toMatchObject({
      session: "session-1",
      timestamp: "2026-10-01T10:30:00Z",
      total: 130,
      cost: 0.01,
    });
  });
});
describe("hourly Codex detail", () => {
  test("ignores repeated cumulative totals and does not double-count cached input or reasoning", () => {
    const usage = {
      input_tokens: 100,
      cached_input_tokens: 20,
      output_tokens: 30,
      reasoning_output_tokens: 10,
      total_tokens: 130,
    };
    const record = {
      type: "event_msg",
      timestamp: "2026-10-01T10:00:00Z",
      payload: {
        type: "token_count",
        info: { total_token_usage: usage, last_token_usage: usage },
      },
    };
    const rows = parseRecords(
      "codex",
      [{ type: "turn_context", payload: { model: "gpt-5.4" } }, record, record],
      "session.jsonl",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      input: 80,
      cacheRead: 20,
      output: 30,
      reasoning: 10,
      total: 130,
    });
  });
  test("uses cumulative deltas when last usage is absent", () => {
    const rows = parseRecords(
      "codex",
      [
        {
          type: "event_msg",
          timestamp: "2026-10-01T10:00:00Z",
          payload: {
            type: "token_count",
            info: {
              total_token_usage: { input_tokens: 100, output_tokens: 10 },
            },
          },
        },
        {
          type: "event_msg",
          timestamp: "2026-10-01T11:00:00Z",
          payload: {
            type: "token_count",
            info: {
              total_token_usage: { input_tokens: 150, output_tokens: 15 },
            },
          },
        },
      ],
      "s.jsonl",
    );
    expect(rows.map((r) => r.total)).toEqual([110, 55]);
  });
});
