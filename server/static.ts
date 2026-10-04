import { resolve, sep } from "node:path";

export async function serveFrontend(req: Request, root: string): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD")
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });

  const url = new URL(req.url);
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return new Response("Invalid path", { status: 400 });
  }
  const directory = resolve(root);
  // The server bundle shares dist with public files but is not a browser asset.
  if (pathname === "/server.js" || pathname.startsWith("/server.js/") ||
      pathname === "/runtime" || pathname.startsWith("/runtime/") ||
      pathname === "/package.json" || pathname.split("/").some(part => part.startsWith(".")))
    return new Response("Not found", { status: 404 });
  const path = resolve(directory, `.${pathname}`);
  if (path !== directory && !path.startsWith(directory + sep))
    return new Response("Not found", { status: 404 });

  let file = Bun.file(pathname === "/" ? resolve(directory, "index.html") : path);
  if (!(await file.exists())) {
    // Browser routes use the SPA entry; missing assets must stay 404s.
    if (pathname.startsWith("/assets/") || pathname.split("/").at(-1)?.includes("."))
      return new Response("Not found", { status: 404 });
    file = Bun.file(resolve(directory, "index.html"));
    if (!(await file.exists())) return new Response("Frontend build missing. Run bun run build.", { status: 503 });
  }
  const headers = {
    "Content-Type": file.type,
    "Cache-Control": pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
  };
  return new Response(req.method === "HEAD" ? null : file, { headers });
}
