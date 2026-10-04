import { expect, test } from "bun:test";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveFrontend } from "./static";

test("production serving distinguishes SPA routes, assets, and private paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "aiusage-static-"));
  try {
    await mkdir(join(root, "assets"));
    await Bun.write(join(root, "index.html"), "<h1>aiusage</h1>");
    await Bun.write(join(root, "assets/app.js"), "console.log('aiusage')");
    await Bun.write(join(root, "server.js"), "private server bundle");
    const request = (path: string, method = "GET") => serveFrontend(new Request(`http://localhost${path}`, { method }), root);
    expect(await (await request("/")).text()).toBe("<h1>aiusage</h1>");
    expect(await (await request("/sessions")).text()).toBe("<h1>aiusage</h1>");
    const asset = await request("/assets/app.js");
    expect(asset.status).toBe(200);
    expect(asset.headers.get("Cache-Control")).toContain("immutable");
    expect((await request("/assets/missing.js")).status).toBe(404);
    expect((await request("/server.js")).status).toBe(404);
    expect((await request("/runtime/ccusage")).status).toBe(404);
    expect((await request("/runtime/.ccusage.json")).status).toBe(404);
    expect((await request("/package.json")).status).toBe(404);
    expect((await request("/%2e%2e%2fpackage.json")).status).toBe(404);
    expect((await request("/%invalid")).status).toBe(400);
    expect((await request("/", "POST")).status).toBe(405);
    expect(await (await request("/", "HEAD")).text()).toBe("");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
