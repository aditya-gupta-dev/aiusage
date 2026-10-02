import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Bot,
  Boxes,
  CalendarDays,
  Check,
  ChevronRight,
  Cpu,
  Database,
  LayoutDashboard,
  Moon,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  Terminal,
  Wallet,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
  CardFooter,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  agents,
  colors,
  compact,
  daily,
  groups,
  localDay,
  money,
  total,
} from "@/lib/analytics";
import type { UsageResponse, UsageEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import "./App.css";
const chartConfig = {
  input: { label: "Input", color: colors[0] },
  output: { label: "Output", color: colors[1] },
  cacheRead: { label: "Cache read", color: colors[2] },
  cacheWrite: { label: "Cache write", color: colors[3] },
  cost: { label: "API cost", color: colors[0] },
  tokens: { label: "Tokens", color: colors[0] },
  claude: { label: "Claude Code", color: colors[0] },
  codex: { label: "Codex", color: colors[1] },
  gemini: { label: "Gemini CLI", color: colors[2] },
  opencode: { label: "OpenCode", color: colors[3] },
};
const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "models", label: "Models", icon: Cpu },
  { id: "sessions", label: "Sessions", icon: Terminal },
  { id: "sources", label: "Data sources", icon: Database },
];
function Filter({
  value,
  onChange,
  items,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v ?? "all")}
      items={items}
    >
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
function Panel({
  title,
  description,
  action,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}
function NoData() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Activity />
        </EmptyMedia>
        <EmptyTitle>No usage in this period</EmptyTitle>
        <EmptyDescription>
          Try a wider date range or scan your local sources again.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
function App() {
  const [data, setData] = useState<UsageResponse>();
  const [sessionEvents, setSessionEvents] = useState<UsageEvent[]>([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("overview");
  const [range, setRange] = useState("30");
  const [agent, setAgent] = useState("all");
  const [model, setModel] = useState("all");
  const [metric, setMetric] = useState("tokens");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("daily");
  const [pageNumber, setPageNumber] = useState(1);
  const [dark, setDark] = useState(
    () => localStorage.getItem("aiusage-theme") === "dark",
  );
  const [today, setToday] = useState(() => localDay(new Date()));
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("aiusage-theme", dark ? "dark" : "light");
  }, [dark]);
  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(force ? "/api/scan" : "/api/usage", {
        method: force ? "POST" : "GET",
      });
      if (!response.ok)
        throw new Error(
          "Could not read local usage. Make sure the backend is running with bun run dev.",
        );
      const result: UsageResponse = await response.json();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const id = setInterval(() => {
      setToday(localDay(new Date()));
      void load();
    }, 60_000);
    return () => clearInterval(id);
  }, [load]);
  useEffect(
    () => setPageNumber(1),
    [query, page, agent, model, range, customStart, customEnd],
  );
  const end = range === "custom" ? customEnd : today;
  const start = useMemo(() => {
    if (range === "custom") return customStart;
    if (range === "all")
      return data?.events[0] ? localDay(data.events[0].timestamp) : today;
    const d = new Date(today + "T12:00");
    d.setDate(d.getDate() - Number(range) + 1);
    return localDay(d);
  }, [range, customStart, data, today]);
  useEffect(() => {
    if (!data) return;
    let active = true;
    setSessionLoading(true);
    setSessionError("");
    fetch(`/api/sessions?since=${start}&until=${end}`)
      .then(async (r) => {
        if (!r.ok)
          throw new Error("Session report failed. Rescan to try again.");
        return r.json();
      })
      .then((r) => {
        if (active) setSessionEvents(r.events);
      })
      .catch((e) => {
        if (active) setSessionError(e.message);
      })
      .finally(() => {
        if (active) setSessionLoading(false);
      });
    return () => {
      active = false;
    };
  }, [start, end, data?.scannedAt]);
  const filteredSessions = useMemo(
    () =>
      sessionEvents.filter(
        (e) =>
          (agent === "all" || e.agent === agent) &&
          (model === "all" || e.model === model),
      ),
    [sessionEvents, agent, model],
  );
  const rows = useMemo(
    () =>
      data?.events.filter((e) => {
        const day = localDay(e.timestamp);
        return (
          day >= start &&
          day <= end &&
          (agent === "all" || e.agent === agent) &&
          (model === "all" || e.model === model)
        );
      }) ?? [],
    [data, start, end, agent, model],
  );
  const totals = useMemo(() => total(rows), [rows]);
  const series = useMemo(() => daily(rows, start, end), [rows, start, end]);
  const modelRows = useMemo(() => groups(rows, "model"), [rows]);
  const agentRows = useMemo(() => groups(rows, "agent"), [rows]);
  const sessionRows = useMemo(
    () =>
      groups(filteredSessions, "session").sort((a, b) =>
        b.events.at(-1)!.timestamp.localeCompare(a.events.at(-1)!.timestamp),
      ),
    [filteredSessions],
  );
  const sessions = sessionRows.length;
  const detected = data?.sources.filter((s) => s.installed).length ?? 0;
  const connected =
    data?.sources.filter((s) => s.status === "connected").length ?? 0;
  const tokens = [
    { name: "Input", value: totals.input, fill: colors[0] },
    { name: "Output", value: totals.output, fill: colors[1] },
    { name: "Cache read", value: totals.cacheRead, fill: colors[2] },
    { name: "Cache write", value: totals.cacheWrite, fill: colors[3] },
  ];
  function exportCsv() {
    const keys: (keyof UsageEvent)[] = [
      "timestamp",
      "agent",
      "model",
      "session",
      "project",
      "input",
      "output",
      "cacheRead",
      "cacheWrite",
      "reasoning",
      "total",
      "cost",
      "costSource",
    ];
    const csv = [
      keys.join(","),
      ...rows.map((e) =>
        keys
          .map((k) => '"' + String(e[k] ?? "").replaceAll('"', '""') + '"')
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-usage-${start}-${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const tableRows = (
    page === "models" ? modelRows : page === "agents" ? agentRows : sessionRows
  ).filter((r) =>
    (r.key + " " + r.events[0].model + " " + r.events[0].project)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const hourlyRows = (data?.rawEvents ?? []).filter(
    (e) =>
      localDay(e.timestamp) >= start &&
      localDay(e.timestamp) <= end &&
      (agent === "all" || e.agent === agent) &&
      (model === "all" || e.model === model),
  );
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    tokens: hourlyRows
      .filter((e) => new Date(e.timestamp).getHours() === hour)
      .reduce((n, e) => n + e.total, 0),
  }));
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("overview");
          }}
        >
          <span className="brand-mark">
            <Boxes />
          </span>
          <span>
            token<span className="brand-light">scope</span>
            <small>YOUR AI, ACCOUNTED FOR.</small>
          </span>
        </a>
        <div className="workspace">
          <div className="workspace-icon">
            <Terminal />
          </div>
          <div>
            <strong>Local workspace</strong>
            <span>Personal dashboard</span>
          </div>
          <Badge variant="outline">LOCAL</Badge>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav
            .filter((item) => item.id !== "sources")
            .map((item) => (
              <Button
                key={item.id}
                aria-label={item.label}
                variant="ghost"
                className={cn("nav-button", page === item.id && "nav-active")}
                onClick={() => setPage(item.id)}
              >
                <item.icon data-icon="inline-start" />
                {item.label}
                {item.id === "agents" && (
                  <span className="nav-count">{detected}</span>
                )}
              </Button>
            ))}
        </nav>
        <div className="nav-label nav-label-second">SYSTEM</div>
        <Button
          variant="ghost"
          className={cn("nav-button", page === "sources" && "nav-active")}
          aria-label="Data sources"
          onClick={() => setPage("sources")}
        >
          <Database data-icon="inline-start" />
          Data sources
          <span className="connection-dot" />
        </Button>
        <div className="sidebar-bottom">
          <div className="local-note">
            <ShieldCheck />
            <strong>Your data stays yours.</strong>
            <p>Usage is read directly from your machine. No account needed.</p>
          </div>
          <Separator />
          <div className="profile">
            <span className="profile-avatar">ME</span>
            <div>
              <strong>My workspace</strong>
              <span>Local environment</span>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Toggle theme"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun /> : <Moon />}
            </Button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace
            <ChevronRight />
            <span>{nav.find((n) => n.id === page)?.label}</span>
          </div>
          <div className="topbar-right">
            <span className="live-indicator" />
            Local connection
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Toggle theme"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun /> : <Moon />}
            </Button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">A LITTLE CLARITY FOR YOUR AI.</div>
              <h1>
                {page === "overview"
                  ? "Usage overview"
                  : nav.find((n) => n.id === page)?.label}
              </h1>
              <p>
                {page === "overview"
                  ? "Every agent. Every model. The complete picture."
                  : page === "sources"
                    ? "Discover your installed agents and check their local usage logs."
                    : `Explore your AI usage by ${page.slice(0, -1)}.`}
              </p>
            </div>
            <div className="heading-actions">
              <Button
                variant="outline"
                onClick={exportCsv}
                disabled={!rows.length}
              >
                <ArrowDownToLine data-icon="inline-start" />
                Export CSV
              </Button>
              <Button onClick={() => void load(true)} disabled={loading}>
                <RefreshCw
                  data-icon="inline-start"
                  className={cn(loading && "animate-spin")}
                />
                {loading ? "Scanning…" : "Scan system"}
              </Button>
            </div>
          </div>
          {sessionError && (
            <Alert variant="destructive">
              <AlertTitle>Session report unavailable</AlertTitle>
              <AlertDescription>{sessionError}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Connection failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {page !== "sources" && (
            <div className="filter-bar">
              <div className="filter-left">
                <CalendarDays />
                <Filter
                  value={range}
                  onChange={setRange}
                  label="Date range"
                  items={[
                    { value: "1", label: "Today" },
                    { value: "7", label: "Last 7 days" },
                    { value: "30", label: "Last 30 days" },
                    { value: "90", label: "Last 90 days" },
                    { value: "all", label: "All time" },
                    { value: "custom", label: "Custom range" },
                  ]}
                />
                <span className="filter-divider" />
                <Filter
                  value={agent}
                  onChange={setAgent}
                  label="Agent"
                  items={[
                    { value: "all", label: "All agents" },
                    ...Object.entries(agents).map(([value, label]) => ({
                      value,
                      label,
                    })),
                  ]}
                />
                <Filter
                  value={model}
                  onChange={setModel}
                  label="Model"
                  items={[
                    { value: "all", label: "All models" },
                    ...[...new Set(data?.events.map((e) => e.model))]
                      .sort()
                      .map((value) => ({ value, label: value })),
                  ]}
                />
              </div>
              <span className="date-label">
                {new Date(start + "T12:00").toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}{" "}
                –{" "}
                {new Date(end + "T12:00").toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
          {range === "custom" && page !== "sources" && (
            <div className="custom-dates">
              <Field>
                <FieldLabel htmlFor="start">From</FieldLabel>
                <Input
                  id="start"
                  type="date"
                  value={customStart}
                  max={customEnd}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="end">To</FieldLabel>
                <Input
                  id="end"
                  type="date"
                  value={customEnd}
                  min={customStart}
                  max={today}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </Field>
            </div>
          )}
          {loading && !data ? (
            <div className="loading-grid">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-44" />
              ))}
            </div>
          ) : (
            <>
              {page !== "sources" && (
                <div className="stat-grid">
                  {[
                    {
                      label: "Total tokens",
                      value: compact(totals.tokens),
                      icon: Zap,
                      detail: `${compact(totals.input + totals.cacheRead + totals.cacheWrite)} input · ${compact(totals.output)} output`,
                      caption: "Across all selected agents",
                    },
                    {
                      label: "API-equivalent cost",
                      value: money(totals.cost),
                      icon: Wallet,
                      detail: totals.unknown
                        ? `${totals.unknown} records without pricing`
                        : "Known model pricing included",
                      caption: "API estimate, not subscription billing",
                    },
                    {
                      label: "Sessions",
                      value: sessionLoading ? "…" : compact(sessions),
                      icon: Terminal,
                      detail: `${compact(rows.length)} daily model summaries`,
                      caption: "Unique agent conversations",
                    },
                    {
                      label: "Cache hit rate",
                      value: `${totals.input + totals.cacheRead ? ((totals.cacheRead / (totals.input + totals.cacheRead)) * 100).toFixed(1) : "0"}%`,
                      icon: Database,
                      detail: `${compact(totals.cacheRead)} cached tokens`,
                      caption: "Read cache / input + read cache",
                    },
                  ].map((s) => (
                    <Card key={s.label} className="stat-card">
                      <CardHeader>
                        <CardDescription>{s.label}</CardDescription>
                        <CardAction>
                          <s.icon />
                        </CardAction>
                      </CardHeader>
                      <CardContent>
                        <div className="stat-value">{s.value}</div>
                        <div className="stat-detail">{s.detail}</div>
                        <div className="stat-caption">{s.caption}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              {page === "overview" && (
                <>
                  <div className="chart-grid">
                    <Panel
                      title="Usage over time"
                      description="A daily breakdown of your token consumption"
                      className="main-chart"
                      action={
                        <ToggleGroup
                          value={[metric]}
                          onValueChange={(v) => v.length && setMetric(v[0])}
                          size="sm"
                          variant="outline"
                          spacing={0}
                        >
                          <ToggleGroupItem value="tokens">
                            Tokens
                          </ToggleGroupItem>
                          <ToggleGroupItem value="cost">Cost</ToggleGroupItem>
                        </ToggleGroup>
                      }
                      footer={
                        <div className="chart-footer">
                          <span>
                            <Activity />
                            {
                              series.filter((d) => Number(d.tokens) > 0).length
                            }{" "}
                            active days in this period
                          </span>
                          <span>
                            Daily ·{" "}
                            {Intl.DateTimeFormat().resolvedOptions().timeZone}
                          </span>
                        </div>
                      }
                    >
                      {rows.length ? (
                        <>
                          <div className="chart-legend">
                            {metric === "tokens" ? (
                              tokens.map((t) => (
                                <span key={t.name}>
                                  <i style={{ background: t.fill }} />
                                  {t.name}
                                </span>
                              ))
                            ) : (
                              <span>
                                <i style={{ background: colors[0] }} />
                                API-equivalent cost (USD)
                              </span>
                            )}
                          </div>
                          <ChartContainer
                            config={chartConfig}
                            className="usage-chart"
                          >
                            <AreaChart
                              accessibilityLayer
                              data={series}
                              margin={{ top: 20, right: 8, bottom: 0, left: 0 }}
                            >
                              <defs>
                                {[
                                  "input",
                                  "output",
                                  "cacheRead",
                                  "cacheWrite",
                                  "cost",
                                ].map((key, i) => (
                                  <linearGradient
                                    key={key}
                                    id={`fill-${key}`}
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                  >
                                    <stop
                                      offset="0%"
                                      stopColor={colors[i % 4]}
                                      stopOpacity={0.25}
                                    />
                                    <stop
                                      offset="100%"
                                      stopColor={colors[i % 4]}
                                      stopOpacity={0.025}
                                    />
                                  </linearGradient>
                                ))}
                              </defs>
                              <CartesianGrid
                                vertical={false}
                                strokeDasharray="3 4"
                              />
                              <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                minTickGap={35}
                                tickMargin={12}
                                tickFormatter={(v) =>
                                  new Date(v + "T12:00").toLocaleDateString(
                                    undefined,
                                    { month: "short", day: "numeric" },
                                  )
                                }
                              />
                              <YAxis
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={
                                  metric === "cost"
                                    ? (v) => `$${compact(v)}`
                                    : compact
                                }
                                width={52}
                              />
                              <ChartTooltip
                                content={
                                  <ChartTooltipContent
                                    labelFormatter={(v) =>
                                      new Date(
                                        String(v) + "T12:00",
                                      ).toLocaleDateString()
                                    }
                                  />
                                }
                              />
                              {(metric === "cost"
                                ? ["cost"]
                                : ["cacheRead", "cacheWrite", "input", "output"]
                              ).map((key) => (
                                <Area
                                  key={key}
                                  type="monotone"
                                  dataKey={key}
                                  stackId="usage"
                                  stroke={`var(--color-${key})`}
                                  fill={`url(#fill-${key})`}
                                  strokeWidth={2}
                                />
                              ))}
                            </AreaChart>
                          </ChartContainer>
                        </>
                      ) : (
                        <NoData />
                      )}
                    </Panel>
                    <Panel
                      title="Token distribution"
                      description="Where your tokens go"
                      className="distribution-card"
                      footer={
                        <span className="muted-note">
                          Output follows each agent’s reporting semantics.
                        </span>
                      }
                    >
                      {rows.length ? (
                        <>
                          <div className="donut-wrap">
                            <ChartContainer
                              config={chartConfig}
                              className="donut-chart"
                            >
                              <PieChart accessibilityLayer>
                                <ChartTooltip
                                  content={
                                    <ChartTooltipContent
                                      nameKey="name"
                                      hideLabel
                                    />
                                  }
                                />
                                <Pie
                                  data={tokens}
                                  dataKey="value"
                                  nameKey="name"
                                  innerRadius={72}
                                  outerRadius={94}
                                  strokeWidth={4}
                                  paddingAngle={2}
                                >
                                  {tokens.map((t) => (
                                    <Cell key={t.name} fill={t.fill} />
                                  ))}
                                </Pie>
                              </PieChart>
                            </ChartContainer>
                            <div className="donut-center">
                              <strong>{compact(totals.tokens)}</strong>
                              <span>total tokens</span>
                            </div>
                          </div>
                          <div className="distribution-legend">
                            {tokens.map((t) => (
                              <div key={t.name}>
                                <span>
                                  <i style={{ background: t.fill }} />
                                  {t.name}
                                </span>
                                <strong>{compact(t.value)}</strong>
                                <span>
                                  {totals.tokens
                                    ? ((t.value / totals.tokens) * 100).toFixed(
                                        1,
                                      )
                                    : 0}
                                  %
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <NoData />
                      )}
                    </Panel>
                  </div>
                  <div className="chart-grid secondary-grid">
                    <Panel
                      title="Usage by agent"
                      description="Your tools, side by side"
                      action={
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPage("agents")}
                        >
                          View all
                          <ArrowUpRight data-icon="inline-end" />
                        </Button>
                      }
                    >
                      {agentRows.length ? (
                        <>
                          <ChartContainer
                            config={chartConfig}
                            className="agent-chart"
                          >
                            <BarChart
                              accessibilityLayer
                              data={agentRows.map((r) => ({
                                ...r,
                                name: agents[r.key as keyof typeof agents],
                              }))}
                              layout="vertical"
                              margin={{ left: 8, right: 20 }}
                            >
                              <CartesianGrid
                                horizontal={false}
                                strokeDasharray="3 4"
                              />
                              <XAxis
                                type="number"
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={compact}
                              />
                              <YAxis
                                type="category"
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                width={90}
                              />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Bar
                                dataKey="tokens"
                                radius={[0, 4, 4, 0]}
                                barSize={20}
                              >
                                {agentRows.map((r, i) => (
                                  <Cell key={r.key} fill={colors[i % 4]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ChartContainer>
                          <div className="agent-footnote">
                            <Badge variant="secondary">
                              {connected} connected
                            </Badge>
                            <span>of {detected} detected agents</span>
                          </div>
                        </>
                      ) : (
                        <NoData />
                      )}
                    </Panel>
                    <Panel
                      title="Top models"
                      description="The models doing the heavy lifting"
                      action={
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPage("models")}
                        >
                          View all
                          <ArrowUpRight data-icon="inline-end" />
                        </Button>
                      }
                    >
                      {modelRows.length ? (
                        <div className="model-list">
                          {modelRows.slice(0, 5).map((r, i) => (
                            <div className="model-item" key={r.key}>
                              <span className="model-rank">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <div className="model-info">
                                <div>
                                  <strong title={r.key}>{r.key}</strong>
                                  <span>{compact(r.tokens)}</span>
                                </div>
                                <Progress
                                  value={
                                    totals.tokens
                                      ? (r.tokens / totals.tokens) * 100
                                      : 0
                                  }
                                />
                              </div>
                              <span className="model-cost">
                                {money(r.cost)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <NoData />
                      )}
                    </Panel>
                  </div>
                  <Panel
                    title="Activity insights"
                    description={
                      tab === "hourly"
                        ? "Hourly detail from direct Claude, Codex and OpenCode logs; coverage may differ from verified totals."
                        : "Daily totals verified by ccusage across all supported agents."
                    }
                    action={
                      <Tabs
                        value={tab}
                        onValueChange={(v) => setTab(String(v))}
                      >
                        <TabsList>
                          <TabsTrigger value="daily">By day</TabsTrigger>
                          <TabsTrigger value="hourly">By hour</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    }
                  >
                    {rows.length ? (
                      <ChartContainer
                        config={chartConfig}
                        className="activity-chart"
                      >
                        <BarChart
                          accessibilityLayer
                          data={tab === "hourly" ? hourly : series}
                          margin={{ top: 15 }}
                        >
                          <CartesianGrid
                            vertical={false}
                            strokeDasharray="3 4"
                          />
                          <XAxis
                            dataKey={tab === "hourly" ? "hour" : "date"}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={25}
                            tickFormatter={(v) =>
                              tab === "hourly"
                                ? v
                                : new Date(v + "T12:00").toLocaleDateString(
                                    undefined,
                                    { month: "short", day: "numeric" },
                                  )
                            }
                          />
                          <YAxis
                            tickFormatter={compact}
                            axisLine={false}
                            tickLine={false}
                            width={50}
                          />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar
                            dataKey="tokens"
                            fill={colors[0]}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={28}
                          />
                        </BarChart>
                      </ChartContainer>
                    ) : (
                      <NoData />
                    )}
                  </Panel>
                </>
              )}
              {["agents", "models", "sessions"].includes(page) && (
                <>
                  <div className="chart-grid">
                    {page === "agents" ? (
                      <Panel
                        title="Agent comparison"
                        description="Tokens consumed per agent"
                      >
                        <ChartContainer
                          config={chartConfig}
                          className="usage-chart"
                        >
                          <BarChart
                            accessibilityLayer
                            data={agentRows.map((r) => ({
                              ...r,
                              name: agents[r.key as keyof typeof agents],
                            }))}
                          >
                            <CartesianGrid vertical={false} />
                            <XAxis
                              dataKey="name"
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              tickFormatter={compact}
                              tickLine={false}
                              axisLine={false}
                            />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="tokens" radius={[4, 4, 0, 0]}>
                              {agentRows.map((r, i) => (
                                <Cell key={r.key} fill={colors[i % 4]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ChartContainer>
                      </Panel>
                    ) : (
                      <Panel
                        title={
                          page === "models"
                            ? "Model consumption"
                            : "Session activity"
                        }
                        description="Token consumption across the selected period"
                      >
                        <ChartContainer
                          config={chartConfig}
                          className="usage-chart"
                        >
                          <BarChart
                            accessibilityLayer
                            data={(page === "models"
                              ? modelRows.slice(0, 8)
                              : series
                            ).map((r) => ({
                              name:
                                "name" in r ? String(r.name) : String(r.date),
                              date: "date" in r ? String(r.date) : "",
                              tokens: r.tokens,
                            }))}
                          >
                            <CartesianGrid vertical={false} />
                            <XAxis
                              dataKey={page === "sessions" ? "date" : "name"}
                              tickLine={false}
                              axisLine={false}
                              hide={page === "models"}
                            />
                            <YAxis
                              tickFormatter={compact}
                              tickLine={false}
                              axisLine={false}
                            />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar
                              dataKey="tokens"
                              fill={colors[0]}
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ChartContainer>
                      </Panel>
                    )}
                    <Panel
                      title="Cost breakdown"
                      description="Known API costs, excluding records without pricing"
                    >
                      <ChartContainer
                        config={chartConfig}
                        className="usage-chart"
                      >
                        <BarChart
                          accessibilityLayer
                          data={(page === "agents" ? agentRows : modelRows)
                            .slice(0, 8)
                            .map((r) => ({
                              ...r,
                              name:
                                page === "agents"
                                  ? agents[r.key as keyof typeof agents]
                                  : r.name,
                            }))}
                          layout="vertical"
                        >
                          <CartesianGrid horizontal={false} />
                          <XAxis
                            type="number"
                            tickFormatter={(v) => `$${compact(v)}`}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={130}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) =>
                              v.length > 20 ? v.slice(0, 18) + "…" : v
                            }
                          />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar
                            dataKey="cost"
                            fill={colors[1]}
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ChartContainer>
                    </Panel>
                  </div>
                  <Panel
                    title={`${nav.find((n) => n.id === page)?.label} breakdown`}
                    description={`${tableRows.length} results · Sorted by ${page === "sessions" ? "recent activity" : "token usage"}`}
                    action={
                      <div className="search-input">
                        <Search />
                        <Input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder={`Search ${page}…`}
                          aria-label={`Search ${page}`}
                        />
                      </div>
                    }
                    footer={
                      <div className="pagination">
                        <span>
                          Showing{" "}
                          {tableRows.length
                            ? Math.min(
                                (pageNumber - 1) * 15 + 1,
                                tableRows.length,
                              )
                            : 0}
                          –{Math.min(pageNumber * 15, tableRows.length)} of{" "}
                          {tableRows.length}
                        </span>
                        <div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pageNumber === 1}
                            onClick={() => setPageNumber(pageNumber - 1)}
                          >
                            Previous
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pageNumber * 15 >= tableRows.length}
                            onClick={() => setPageNumber(pageNumber + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    }
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            {page === "sessions"
                              ? "Session"
                              : page === "models"
                                ? "Model"
                                : "Agent"}
                          </TableHead>
                          {page === "sessions" && (
                            <TableHead>Model / Agent</TableHead>
                          )}
                          <TableHead>Input</TableHead>
                          <TableHead>Output</TableHead>
                          <TableHead>Cache read / write</TableHead>
                          <TableHead>Total tokens</TableHead>
                          <TableHead>Known cost</TableHead>
                          <TableHead>
                            {page === "sessions" ? "Last active" : "Sessions"}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tableRows
                          .slice((pageNumber - 1) * 15, pageNumber * 15)
                          .map((r) => (
                            <TableRow key={r.key}>
                              <TableCell>
                                <div className="table-name" title={r.key}>
                                  {page === "agents"
                                    ? agents[r.key as keyof typeof agents]
                                    : page === "sessions"
                                      ? r.events[0].session
                                      : r.key}
                                </div>
                                {page === "sessions" && (
                                  <span className="muted-note">
                                    {r.events[0].project || "Unknown project"}
                                  </span>
                                )}
                              </TableCell>
                              {page === "sessions" && (
                                <TableCell>
                                  <div>
                                    {[
                                      ...new Set(r.events.map((e) => e.model)),
                                    ].join(", ")}
                                  </div>
                                  <span className="muted-note">
                                    {agents[r.events[0].agent]}
                                  </span>
                                </TableCell>
                              )}
                              <TableCell>{compact(r.input)}</TableCell>
                              <TableCell>{compact(r.output)}</TableCell>
                              <TableCell>
                                {compact(r.cacheRead)} / {compact(r.cacheWrite)}
                              </TableCell>
                              <TableCell>
                                <strong>{compact(r.tokens)}</strong>
                              </TableCell>
                              <TableCell>
                                {money(r.cost)}
                                {r.unknown > 0 && (
                                  <span className="muted-note block">
                                    {r.unknown} unpriced
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {page === "sessions"
                                  ? new Date(
                                      r.events.at(-1)!.timestamp,
                                    ).toLocaleString()
                                  : new Set(
                                      filteredSessions
                                        .filter((e) =>
                                          page === "models"
                                            ? e.model === r.key
                                            : page === "agents"
                                              ? e.agent === r.key
                                              : e.project === r.key,
                                        )
                                        .map((e) => `${e.agent}:${e.session}`),
                                    ).size}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    {!tableRows.length && <NoData />}
                  </Panel>
                </>
              )}
              {page === "sources" && (
                <>
                  <div className="source-summary">
                    <div className="source-summary-icon">
                      <ShieldCheck />
                    </div>
                    <div>
                      <strong>Local by design</strong>
                      <p>
                        Known agent folders and executables are detected
                        automatically. Only usage metadata is returned to the
                        dashboard.
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {connected} sources connected
                    </Badge>
                  </div>
                  <div className="source-grid">
                    {data?.sources.map((source) => (
                      <Panel
                        key={source.id}
                        title={source.name}
                        description={
                          source.installed
                            ? "Detected on this system"
                            : "Not detected"
                        }
                        action={
                          <Badge
                            variant={
                              source.status === "connected"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {source.status === "connected" && (
                              <Check data-icon="inline-start" />
                            )}
                            {source.status}
                          </Badge>
                        }
                        footer={
                          <span className="muted-note">{source.note}</span>
                        }
                      >
                        <div className="source-metrics">
                          <span>
                            <strong>{source.files || "—"}</strong> direct files
                            scanned
                          </span>
                          <span>
                            <strong>{compact(source.events)}</strong> daily
                            summaries
                          </span>
                          <span>
                            <strong>{source.errors}</strong> read / parse errors
                          </span>
                        </div>
                        <div className="source-paths">
                          {source.paths.map((p) => (
                            <code key={p}>{p}</code>
                          ))}
                        </div>
                      </Panel>
                    ))}
                  </div>
                  <Alert>
                    <Database />
                    <AlertTitle>About usage and pricing</AlertTitle>
                    <AlertDescription>
                      Usage reports use ccusage’s adapters for 18 agents,
                      including Claude Code, Codex, OpenCode, Antigravity,
                      Gemini, Copilot, Amp, Droid, and more. Cursor, Cline, and
                      Aider are detected separately and marked unsupported.
                      API-equivalent costs use a bundled pricing snapshot from
                      ccusage (updated {data?.pricingUpdated}); unknown models
                      retain their tokens and are marked unpriced. Subscription
                      fees, credits, and provider billing adjustments are not
                      included. Custom locations can be configured through
                      environment variables in the backend. Daily summaries have
                      day-level precision; session reports are filtered by
                      actual usage dates.
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <ShieldCheck />
              Stored on your machine. Built for peace of mind.
            </span>
            <span>
              {data
                ? `Last scanned ${new Date(data.scannedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · ${data.duration} ms`
                : "Waiting for local scan"}
              <span className="footer-dot" />
              Refreshes every minute
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
export default App;
