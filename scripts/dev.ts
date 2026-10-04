const backend = Bun.spawn(["bun", "--watch", "server/index.ts"], {
  stdout: "inherit",
  stderr: "inherit",
});
const frontend = Bun.spawn(["bun", "x", "vite", "--host", "0.0.0.0"], {
  stdout: "inherit",
  stderr: "inherit",
});
function stop() {
  backend.kill();
  frontend.kill();
}
process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});
await Promise.race([backend.exited, frontend.exited]);
stop();

export {};
