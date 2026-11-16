#!/usr/bin/env node
// Stand-in for the `claude` and `copilot` CLIs in tests: no network, no tokens.
// It behaves like the binary it is installed as (by file name), logs its
// arguments to FAKE_AGENT_LOG, and writes the files the runner's task asks for.
// FAKE_AGENT_MODE: ok (default) | fail | is_error | hang | outside
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const flavor = path.basename(process.argv[1]).replace(/\.[^.]+$/, "");
const args = process.argv.slice(2);
const mode = process.env.FAKE_AGENT_MODE ?? "ok";

if (process.env.FAKE_AGENT_LOG) {
  appendFileSync(
    process.env.FAKE_AGENT_LOG,
    `${JSON.stringify({ flavor, cwd: process.cwd(), args })}\n`,
  );
}

if (mode === "hang") setInterval(() => {}, 1000);
else main();

function main() {
  if (mode === "fail") {
    process.stderr.write("something went wrong\nError: fake failure\n");
    process.exit(3);
  }
  const prompt = args[args.indexOf("-p") + 1] ?? "";
  const lines = prompt.split("\n");
  const start = lines.findIndex((l) => l.startsWith("Write exactly these paths"));
  const writes = [];
  for (let i = start + 1; start >= 0 && lines[i]?.startsWith("- "); i++)
    writes.push(lines[i].slice(2));
  const critic = prompt.includes("End your critique with a last line");

  for (const target of writes) {
    const file = target.endsWith("/") ? `${target}index.html` : target;
    write(
      file,
      critic
        ? `# Critique by ${flavor}\n\nLooks fine.\n\nAPPROVED\n`
        : `# Written by fake ${flavor}\n`,
    );
  }
  if (mode === "outside") write("not-mine.md", "oops\n");

  if (flavor === "claude") {
    const isError = mode === "is_error";
    process.stdout.write(
      `${JSON.stringify({
        type: "result",
        subtype: isError ? "error_during_execution" : "success",
        is_error: isError,
        result: isError ? "Not logged in. Please run /login" : "Done.",
        total_cost_usd: 0.0125,
      })}\n`,
    );
  } else {
    process.stdout.write("Done.\n");
  }
}

function write(rel, content) {
  const abs = path.join(process.cwd(), ...rel.split("/"));
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}
