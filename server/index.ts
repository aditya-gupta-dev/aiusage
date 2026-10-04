import { collect } from "./collector";
import { normalize, report } from "./engine";
import { serveFrontend } from "./static";
// Bun's bundler can inline process.env.NODE_ENV; read the runtime environment.
const production = Bun.env.NODE_ENV === "production";
const sessionCache = new Map<
  string,
  { at: number; events: ReturnType<typeof normalize> }
>();
let cache: Awaited<ReturnType<typeof collect>> | undefined;
let pending: ReturnType<typeof collect> | undefined;
async function scan(force = false) {
  if (cache && !force && Date.now() - Date.parse(cache.scannedAt) < 60_000)
    return cache;
  if (!pending)
    pending = collect()
      .then((r) => (cache = r))
      .finally(() => (pending = undefined));
  return pending;
}
const port = Number(process.env.API_PORT || 3847);
Bun.serve({
  hostname: process.env.HOST || (production ? "0.0.0.0" : "127.0.0.1"),
  port,
  idleTimeout: 120,
  async fetch(req) {
    const url = new URL(req.url);
    try {
      if (url.pathname === "/api/sessions" && req.method === "GET") {
        const since = url.searchParams.get("since") ?? undefined,
          until = url.searchParams.get("until") ?? undefined;
        for (const date of [since, until])
          if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
            return new Response("Invalid date", { status: 400 });
        const key = `${since}:${until}`;
        const saved = sessionCache.get(key);
        if (saved && Date.now() - saved.at < 60_000)
          return Response.json({ events: saved.events });
        const events = normalize(
          await report("session", since, until),
          "session",
        );
        if (sessionCache.size > 25) sessionCache.clear();
        sessionCache.set(key, { at: Date.now(), events });
        return Response.json({ events });
      }
      if (url.pathname === "/api/health") return Response.json({ ok: true });
      if (url.pathname === "/api/usage" && req.method === "GET")
        return Response.json(await scan());
      if (url.pathname === "/api/scan" && req.method === "POST") {
        const origin = req.headers.get("origin");
        if (
          origin &&
          origin !== url.origin &&
          !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
        )
          return new Response("Forbidden", { status: 403 });
        sessionCache.clear();
        return Response.json(await scan(true));
      }
      if (url.pathname === "/api" || url.pathname.startsWith("/api/"))
        return new Response("Not found", { status: 404 });
      if (production) return serveFrontend(req, import.meta.dir);
      return new Response("Not found", { status: 404 });
    } catch {
      return Response.json(
        { error: "Local usage scan failed. Check the backend terminal." },
        { status: 500 },
      );
    }
  },
});
console.log(`${production ? "aiusage dashboard and API" : "Usage API"} running at http://localhost:${port}`);
