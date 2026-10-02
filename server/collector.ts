import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { Database } from "bun:sqlite";
import { parseRecords } from "./parsers";
import { agentNames, normalize, report } from "./engine";
import type {
  AgentId,
  Source,
  UsageResponse,
  UsageEvent,
} from "../src/lib/types";
const home = process.env.AIUSAGE_HOME || homedir();
const paths = (env: string, defaults: string[]) =>
  process.env[env]
    ?.split(",")
    .map((x) => x.trim())
    .filter(Boolean) ?? defaults;
const definitions: {
  id: AgentId;
  name: string;
  command: string;
  roots: string[];
  paths: string[];
}[] = [
  {
    id: "claude",
    name: "Claude Code",
    command: "claude",
    roots: paths("CLAUDE_CONFIG_DIR", [
      join(home, ".claude"),
      join(home, ".config/claude"),
    ]),
    paths: paths("CLAUDE_CONFIG_DIR", [
      join(home, ".claude"),
      join(home, ".config/claude"),
    ]).map((p) => join(p, "projects")),
  },
  {
    id: "codex",
    name: "Codex",
    command: "codex",
    roots: paths("CODEX_HOME", [join(home, ".codex")]),
    paths: paths("CODEX_HOME", [join(home, ".codex")]).flatMap((p) => [
      join(p, "sessions"),
      join(p, "archived_sessions"),
    ]),
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    command: "gemini",
    roots: [join(home, ".gemini")],
    paths: paths("GEMINI_DATA_DIR", [join(home, ".gemini/tmp")]),
  },
  {
    id: "opencode",
    name: "OpenCode",
    command: "opencode",
    roots: paths("OPENCODE_DATA_DIR", [
      join(process.env.XDG_DATA_HOME || join(home, ".local/share"), "opencode"),
    ]),
    paths: paths("OPENCODE_DATA_DIR", [
      join(process.env.XDG_DATA_HOME || join(home, ".local/share"), "opencode"),
    ]),
  },
];
async function exists(p: string) {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}
async function walk(
  root: string,
  errors: { count: number },
): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const results = await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? walk(join(root, e.name), errors)
          : Promise.resolve(
              e.isFile() && /\.jsonl?$/.test(e.name)
                ? [join(root, e.name)]
                : [],
            ),
      ),
    );
    return results.flat();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") errors.count++;
    return [];
  }
}
export async function collect(): Promise<UsageResponse> {
  const start = performance.now();
  const all: UsageEvent[] = [];
  const sources: Source[] = [];
  for (const def of definitions) {
    const errors = { count: 0 };
    let files = 0;
    const events: UsageEvent[] = [];
    const installed =
      !!Bun.which(def.command) ||
      (await Promise.all([...def.roots, ...def.paths].map(exists))).some(
        Boolean,
      );
    const found = await Promise.all(
      def.paths.map((p) =>
        walk(def.id === "opencode" ? join(p, "storage/message") : p, errors),
      ),
    );
    for (const file of [...new Set(found.flat())]) {
      files++;
      try {
        const content = await readFile(file, "utf8");
        const rows = [];
        if (file.endsWith(".jsonl")) {
          for (const line of content.split("\n")) {
            if (!line.trim()) continue;
            try {
              rows.push(JSON.parse(line));
            } catch {
              errors.count++;
            }
          }
        } else rows.push(JSON.parse(content));
        events.push(...parseRecords(def.id, rows, file));
      } catch {
        errors.count++;
      }
    }
    if (def.id === "opencode")
      for (const root of def.paths) {
        const dbPath = join(root, "opencode.db");
        if (!(await Bun.file(dbPath).exists())) continue;
        files++;
        let db: Database | undefined;
        try {
          db = new Database(dbPath, { readonly: true });
          for (const table of ["message", "session_message"]) {
            if (
              !db
                .query(
                  "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                )
                .get(table)
            )
              continue;
            const rows = db.query(`SELECT * FROM ${table}`).all() as Record<
              string,
              any
            >[];
            for (const row of rows) {
              try {
                const r = JSON.parse(row.data);
                events.push(
                  ...parseRecords(
                    "opencode",
                    [
                      {
                        ...r,
                        id: row.id,
                        sessionID: row.session_id,
                        time: r.time ?? { created: row.time_created },
                      },
                    ],
                    dbPath,
                  ),
                );
              } catch {
                errors.count++;
              }
            }
          }
        } catch {
          errors.count++;
        } finally {
          db?.close();
        }
      }
    const unique = [...new Map(events.map((e) => [e.id, e])).values()];
    all.push(...unique);
    sources.push({
      id: def.id,
      name: def.name,
      installed,
      status: unique.length
        ? "connected"
        : errors.count
          ? "error"
          : installed
            ? "empty"
            : "missing",
      paths: def.paths,
      files,
      events: unique.length,
      errors: errors.count,
      note: unique.length
        ? "Local usage logs connected"
        : errors.count
          ? "Some files could not be read or parsed"
          : installed
            ? "Detected; no supported usage records found"
            : "No installation or local logs detected",
    });
  }
  for (const [id, name, command, roots] of [
    [
      "cursor",
      "Cursor",
      "cursor",
      [
        join(home, ".config/Cursor"),
        join(home, "Library/Application Support/Cursor"),
      ],
    ],
    [
      "cline",
      "Cline",
      "cline",
      [
        join(home, ".cline"),
        join(home, ".config/Code/User/globalStorage/saoudrizwan.claude-dev"),
      ],
    ],
    ["aider", "Aider", "aider", [join(home, ".aider")]],
    ["copilot", "GitHub Copilot", "copilot", [join(home, ".copilot")]],
  ] as const) {
    const installed =
      !!Bun.which(command) ||
      (await Promise.all(roots.map(exists))).some(Boolean);
    sources.push({
      id,
      name,
      installed,
      status: installed ? "unsupported" : "missing",
      paths: [...roots],
      files: 0,
      events: 0,
      errors: 0,
      note: installed
        ? "Detected; this log format is not yet supported"
        : "No installation or local logs detected",
    });
  }
  const canonical = normalize(await report("daily"), "daily");
  for (const [id, name] of Object.entries(agentNames)) {
    const count = canonical.filter((e) => e.agent === id).length;
    let source = sources.find((s) => s.id === id);
    if (!source) {
      source = {
        id,
        name,
        installed: count > 0 || !!Bun.which(id),
        status: "missing",
        paths: [],
        files: 0,
        events: 0,
        errors: 0,
        note: "No supported usage logs detected",
      };
      sources.push(source);
    }
    if (count) {
      source.installed = true;
      source.status = "connected";
      source.events = count;
      source.note =
        "Usage verified by ccusage; records are daily model summaries";
    } else if (source.installed && source.status === "unsupported" && id !== "cursor" && id !== "cline" && id !== "aider") {
      source.status = "empty";
      source.note = "Detected; no supported usage records found";
    }
  }
  return {
    events: canonical,
    rawEvents: [...new Map(all.map((e) => [e.id, e])).values()].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp),
    ),
    engine: "ccusage 20.0.26",
    sources,
    scannedAt: new Date().toISOString(),
    duration: Math.round(performance.now() - start),
    pricingUpdated: "2026-10-02",
  };
}
