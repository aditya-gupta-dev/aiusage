# aiusage

A local dashboard for AI coding-agent usage. Track tokens, API-equivalent costs, models, agents, and sessions from logs already on your machine.

## Run

Install [Bun](https://bun.sh), then:

```bash
git clone https://github.com/aditya-gupta-dev/aiusage.git
cd aiusage
bun install
bun run dev
```

If you already have the project, run `bun install` and `bun run dev` from its directory.

**One command starts both services:**

- Frontend: **http://localhost:5173** (Vite prints another port if 5173 is occupied).
- Backend: **http://127.0.0.1:3847**.

Keep the terminal open. Press **Ctrl+C** to stop. The frontend listens on all network interfaces, so you can also open the printed Network URL from another device on your LAN. The API remains bound to loopback and is accessed through Vite's proxy. LAN access exposes the dashboard's usage metadata to devices that can reach the frontend.

## Production build and start

Build the frontend and Bun server together:

```bash
bun run build
```

Start both from the compiled output in one process:

```bash
bun run start
```

Open **http://localhost:3847**. The Bun server serves the built dashboard and API from the same port; Vite is not needed at runtime. It listens on all network interfaces, like the development frontend. Set `HOST=127.0.0.1` to limit access to this machine, or `API_PORT=4000` to change the production port.

To build and immediately run with a single command:

```bash
bun run build:start
```

Run these commands from the project directory. Keep `node_modules` and `.ccusage.json` available alongside `dist/`: the compiled server still invokes the installed ccusage CLI and its native adapter. The build bundles the application backend; it is not a standalone executable.

## Dashboard

- **Overview:** token and cost totals, cache hit rate, daily usage, token distribution, agent comparisons, top models, and activity charts.
- **Agents and Models:** usage and cost comparisons with searchable tables.
- **Sessions:** date-filtered conversations with token and model breakdowns.
- **Data sources:** detected agents, connection status, known log paths, and direct-parser errors.
- Date presets and custom ranges, agent/model filters, CSV export, light/dark themes, and responsive layouts.
- Automatic refresh every minute; **Scan system** forces a fresh scan.

## How usage is collected

The Bun backend runs [ccusage](https://github.com/ccusage/ccusage) in **offline mode** for authoritative daily and session reports. It supports 18 agent adapters: Claude Code, Codex, OpenCode, Gemini CLI, Antigravity, GitHub Copilot, Amp, Droid, Codebuff, Hermes, Pi, Goose, Kilo Code, Kimi, Qwen Code, OpenClaw, Grok Build, and ZCode.

Availability depends on each agent's log format and whether it records usage. A detected installation may have no supported records. Cursor, Cline, and Aider have additional installation checks but their usage formats are not supported here. Discovery checks known locations and executables rather than searching every file on the computer.

Daily totals are model summaries at **day-level precision**. Session reports filter usage by the requested dates. Additional direct parsers read Claude Code, Codex, Gemini, and OpenCode logs; the hourly chart uses timestamped Claude, Codex, and OpenCode detail, so its coverage can differ from the daily totals.

Logs and databases are read locally. Responses contain usage metadata, model names, session identifiers, and available working-directory paths—not conversation text. Reports are cached in memory; no dashboard account or cloud database is required.

## Costs and pricing

Costs represent **API-equivalent estimates**, not subscription charges or final provider bills. Credits, discounts, and billing adjustments are not included. Unpriced models keep their token counts and are excluded from known-cost totals; the interface provides an explanation for unpriced records.

The authoritative engine uses ccusage's offline pricing plus the project configuration in **`.ccusage.json`**. That file contains model-specific overrides; review them against your intended rates. Overrides use prices **per token**. The separate `server/pricing.json` snapshot is used by direct-log detail parsers, not the authoritative daily/session engine.

## Custom log locations

Set environment variables before starting the app:

```bash
CODEX_HOME=/path/to/codex bun run dev
```

| Variable | Purpose |
| --- | --- |
| `AIUSAGE_HOME` | Override the home directory used for discovery and the ccusage subprocess. |
| `CLAUDE_CONFIG_DIR` | Claude configuration directories; direct discovery reads their `projects` subdirectories. |
| `CODEX_HOME` | Codex home directories containing `sessions` and/or `archived_sessions`. |
| `GEMINI_DATA_DIR` | Gemini usage-log directories. |
| `OPENCODE_DATA_DIR` | OpenCode data directories containing storage files and/or `opencode.db`. |
| `XDG_DATA_HOME` | Base data directory used for OpenCode's default location. |

The direct collectors accept comma-separated paths for the agent-specific variables above. Other ccusage adapters honor their own environment variables; consult ccusage's documentation for those formats.

The backend also reads `API_PORT`, but Vite's `/api` proxy targets port **3847**. For development, update the proxy in `vite.config.ts` if you change that port. Production serves the frontend and API on the same port and needs no proxy.

## Development

Built with React 19, TypeScript, Vite, Tailwind CSS 4, shadcn components using **Base UI**, shadcn charts/Recharts, and Bun.

| Command | What it does |
| --- | --- |
| `bun run dev` | Start frontend and backend together with hot reload. |
| `bun run dev:frontend` | Start only Vite; requires a running backend for usage data. |
| `bun run dev:backend` | Start only the Bun API in watch mode. |
| `bun run build` | Type-check and build both frontend and server into `dist/`. |
| `bun run start` | Serve the compiled dashboard and API together on port 3847. |
| `bun run build:start` | Build both services, then start production. |
| `bun run build:frontend` | Build only the frontend; Vite recreates `dist/`. |
| `bun run build:server` | Type-check and bundle the backend as `dist/server.js`. |
| `bun run check:server` | Type-check the backend and launch script. |
| `bun test` | Run backend normalization and token-counter tests. |
| `bun run lint` | Run Oxlint. |
| `bun run preview` | Preview the frontend build; it does not start or proxy the API. Use `bun run dev` for the complete dashboard. |

```text
src/App.tsx             Dashboard state, charts, filters, and tables
src/components/ui/      shadcn Base UI components and chart primitives
src/lib/                Shared types and analytics
server/index.ts         Local API and report cache
server/engine.ts        ccusage report runner and normalization
server/collector.ts     Agent discovery and direct-log collection
server/parsers.ts       Direct usage parsers and detail pricing
scripts/dev.ts          Combined frontend/backend launcher
.ccusage.json           Engine pricing overrides
TODO.md                 Task completion and validation history
```

## Troubleshooting

- **Connection failed:** start with `bun run dev`, and check both services' terminal output.
- **Port 3847 in use:** stop the other backend instance before launching another. The frontend may choose another port; use the URL Vite prints.
- **Empty dashboard:** choose **All time**, inspect **Data sources**, and check whether your agents have saved token-bearing logs.
- **Missing costs:** check the model's unpriced explanation and configure appropriate pricing overrides.
- **Different hourly and daily totals:** daily totals use ccusage's full adapter coverage; hourly detail has narrower direct-log coverage.

The bundled ccusage-derived pricing data retains its upstream license in `server/CCUSAGE-LICENSE`.
