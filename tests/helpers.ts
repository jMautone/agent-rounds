import { chmodSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach } from "vitest";
import { EXAMPLE } from "./example.js";

const created: string[] = [];

afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

export function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agent-rounds-"));
  created.push(dir);
  return dir;
}

/** Copy the example team (without its versioned runs) into a temp dir. */
export function copyExampleTeam(): { dir: string; teamFile: string; runsDir: string } {
  const dir = tempDir();
  cpSync(EXAMPLE.dir, dir, {
    recursive: true,
    filter: (src) => !src.split(path.sep).includes("runs"),
  });
  return { dir, teamFile: path.join(dir, "team.yaml"), runsDir: path.join(dir, "runs") };
}

/** Write a team.yaml (and empty role prompts) into a temp dir and return its path. */
export function writeTeam(yaml: string, prompts: string[] = ["roles/a.md"]): string {
  const dir = tempDir();
  for (const p of prompts) {
    const abs = path.join(dir, ...p.split("/"));
    cpSync(path.join(EXAMPLE.dir, "roles", "research.md"), abs, { recursive: true });
  }
  const file = path.join(dir, "team.yaml");
  writeFileSync(file, yaml);
  return file;
}

export function read(dir: string, rel: string): string {
  return readFileSync(path.join(dir, ...rel.split("/")), "utf8");
}

/**
 * A temp folder with fake `claude` and `copilot` binaries (tests/fixtures/fake-agent.mjs)
 * and an env whose PATH finds them first. Unix only: Windows cannot run a
 * shebang script as `claude` without a shell.
 */
export function fakeAgentBin(mode = "ok"): { env: NodeJS.ProcessEnv; log: string } {
  const bin = tempDir();
  const fixture = path.join(EXAMPLE.dir, "..", "..", "tests", "fixtures", "fake-agent.mjs");
  for (const name of ["claude", "copilot"]) {
    const target = path.join(bin, name);
    cpSync(fixture, target);
    chmodSync(target, 0o755);
  }
  const log = path.join(bin, "calls.jsonl");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
    FAKE_AGENT_LOG: log,
    FAKE_AGENT_MODE: mode,
  };
  delete env.AGENT_ROUNDS_CLAUDE_BIN;
  delete env.AGENT_ROUNDS_COPILOT_BIN;
  return { env, log };
}

/** The calls the fake agent logged, in order. */
export function fakeAgentCalls(log: string): { flavor: string; cwd: string; args: string[] }[] {
  return readFileSync(log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}
