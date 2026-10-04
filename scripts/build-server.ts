import { chmod, copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const platform = process.platform;
const arch = process.arch;
const require = createRequire(import.meta.url);
const binaryName = platform === "win32" ? "ccusage.exe" : "ccusage";
const nativePackage = `@ccusage/ccusage-${platform}-${arch}`;
let nativeBinary: string;
try {
  nativeBinary = require.resolve(`${nativePackage}/bin/${binaryName}`);
} catch {
  throw new Error(`Missing ccusage binary for ${platform}-${arch}. Run bun install with optional dependencies enabled.`);
}

const output = resolve(root, "dist");
const runtime = resolve(output, "runtime");
await mkdir(runtime, { recursive: true });
const result = await Bun.build({
  entrypoints: [resolve(root, "server/index.ts")],
  target: "bun",
  outdir: output,
  naming: "server.js",
  define: { "process.env.AIUSAGE_BUILD": JSON.stringify("production") },
});
if (!result.success) throw new AggregateError(result.logs, "Server build failed");

await copyFile(nativeBinary, resolve(runtime, binaryName));
if (platform !== "win32") await chmod(resolve(runtime, binaryName), 0o755);
await copyFile(resolve(root, ".ccusage.json"), resolve(runtime, ".ccusage.json"));
await copyFile(resolve(root, "server/CCUSAGE-LICENSE"), resolve(runtime, "CCUSAGE-LICENSE"));
await Bun.write(resolve(runtime, "platform.json"), JSON.stringify({ platform, arch }, null, 2) + "\n");
await Bun.write(resolve(output, "package.json"), JSON.stringify({ name: "aiusage-runtime", private: true, type: "module", scripts: { start: "bun server.js" } }, null, 2) + "\n");
console.log(`Server and ccusage runtime built for ${platform}-${arch}. Run bun dist/server.js, or cd dist and bun run start.`);
