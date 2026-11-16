import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AgentAdapter } from "../agents/types.js";
import {
  checkWritesExist,
  checkWritesOnlyOwnFiles,
  diffSnapshots,
  readVerdict,
  snapshot,
  type Verdict,
  type Violation,
} from "./contracts.js";
import { renderDelivery } from "./delivery.js";
import { buildPlan, critiqueFile, writesFor } from "./plan.js";
import { buildTaskPrompt } from "./task.js";
import { DELIVERY_FILE, REQUEST_FILE, type Role, RUN_LOG_FILE, type Team } from "./team.js";

export const DEFAULT_STEP_TIMEOUT_MS = 15 * 60 * 1000;

export type StepStatus = "ok" | "failed";
export type RunStatus = "completed" | "completed_with_observations" | "failed";

export interface StepRecord {
  index: number;
  role: string;
  kind: "author" | "critic";
  round: number;
  status: StepStatus;
  verdict: Verdict | null;
  /** Files the step was required to write, in this round. */
  writes: string[];
  /** Files the step actually created or changed (relative, sorted). */
  changed: string[];
  violations: Violation[];
  /** Set when the agent process itself failed. */
  error: string | null;
  durationMs: number;
  costUsd: number | null;
}

export interface ReviewRecord {
  author: string;
  critic: string;
  maxRounds: number;
  rounds: number;
  finalVerdict: Verdict | null;
  /** True when the critic still asked for CHANGES after the last allowed round. */
  withObservations: boolean;
}

export interface RunRecord {
  version: 1;
  team: string;
  agent: string;
  request: string;
  runDir: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totalCostUsd: number;
  roles: string[];
  steps: StepRecord[];
  reviews: ReviewRecord[];
}

export type RunEvent =
  | { type: "run-start"; runDir: string; team: string; agent: string }
  | { type: "step-start"; role: string; kind: "author" | "critic"; round: number }
  | { type: "step-end"; step: StepRecord }
  | { type: "review-exhausted"; review: ReviewRecord }
  | { type: "run-end"; record: RunRecord };

export interface RunOptions {
  team: Team;
  request: string;
  agent: AgentAdapter;
  /** Parent folder for runs, e.g. ./runs. */
  runsDir: string;
  /** Folder name inside runsDir. Defaults to <date>-<time>-<slug>. */
  runName?: string;
  timeoutMs?: number;
  onEvent?: (event: RunEvent) => void;
  /** Injected for tests. */
  now?: () => Date;
}

export async function runTeam(opts: RunOptions): Promise<RunRecord> {
  const request = opts.request.trim();
  if (request.length === 0) throw new Error("the request is empty");

  const now = opts.now ?? (() => new Date());
  const started = now();
  const runDir = createRunDir(opts.runsDir, opts.runName ?? defaultRunName(started, request));
  const emit = opts.onEvent ?? (() => {});
  const timeoutMs = opts.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;

  writeFileSync(path.join(runDir, REQUEST_FILE), `${request}\n`);
  emit({ type: "run-start", runDir, team: opts.team.name, agent: opts.agent.name });

  const steps: StepRecord[] = [];
  const reviews: ReviewRecord[] = [];

  const runStep = async (
    role: Role,
    kind: "author" | "critic",
    round: number,
    extra: { reviews?: string[]; critique?: string },
  ): Promise<StepRecord> => {
    emit({ type: "step-start", role: role.id, kind, round });
    const writes = writesFor(role, round);
    const input = {
      team: opts.team.name,
      roleId: role.id,
      kind,
      round,
      cwd: runDir,
      systemPromptPath: role.promptPath,
      request,
      reads: role.reads,
      writes,
      ...extra,
    };
    const before = snapshot(runDir);
    const t0 = now().getTime();
    let result: Awaited<ReturnType<AgentAdapter["run"]>>;
    try {
      result = await opts.agent.run({ ...input, prompt: buildTaskPrompt(input), timeoutMs });
    } catch (err) {
      result = { exitCode: 1, error: err instanceof Error ? err.message : String(err) };
    }
    const durationMs = now().getTime() - t0;
    const after = snapshot(runDir);
    const diff = diffSnapshots(before, after);

    const violations: Violation[] = [];
    let verdict: Verdict | null = null;
    if (result.exitCode === 0) {
      violations.push(...checkWritesExist(runDir, writes, after));
    }
    violations.push(...checkWritesOnlyOwnFiles(diff, writes));
    if (result.exitCode === 0 && kind === "critic" && violations.length === 0) {
      const v = readVerdict(runDir, critiqueFile(role, round));
      if (v.violation) violations.push(v.violation);
      verdict = v.verdict ?? null;
    }

    const step: StepRecord = {
      index: steps.length + 1,
      role: role.id,
      kind,
      round,
      status: result.exitCode === 0 && violations.length === 0 ? "ok" : "failed",
      verdict,
      writes,
      changed: [...diff.added, ...diff.modified].sort(),
      violations,
      error:
        result.exitCode === 0
          ? null
          : (result.error ?? `agent exited with code ${result.exitCode}`),
      durationMs,
      costUsd: result.costUsd ?? null,
    };
    steps.push(step);
    emit({ type: "step-end", step });
    return step;
  };

  let failed = false;
  segments: for (const { author, critic } of buildPlan(opts.team)) {
    const first = await runStep(author, "author", 1, {});
    if (first.status === "failed") {
      failed = true;
      break;
    }
    if (!critic) continue;

    const review: ReviewRecord = {
      author: author.id,
      critic: critic.id,
      maxRounds: critic.maxRounds,
      rounds: 0,
      finalVerdict: null,
      withObservations: false,
    };
    reviews.push(review);
    const reviewed = writesFor(author, 1);

    for (let round = 1; round <= critic.maxRounds; round++) {
      const crit = await runStep(critic, "critic", round, { reviews: reviewed });
      review.rounds = round;
      if (crit.status === "failed") {
        failed = true;
        break segments;
      }
      review.finalVerdict = crit.verdict;
      if (crit.verdict === "APPROVED") break;
      if (round === critic.maxRounds) {
        review.withObservations = true;
        emit({ type: "review-exhausted", review });
        break;
      }
      const redo = await runStep(author, "author", round + 1, {
        critique: critiqueFile(critic, round),
      });
      if (redo.status === "failed") {
        failed = true;
        break segments;
      }
    }
  }

  const finished = now();
  const record: RunRecord = {
    version: 1,
    team: opts.team.name,
    agent: opts.agent.name,
    request,
    runDir,
    status: failed
      ? "failed"
      : reviews.some((r) => r.withObservations)
        ? "completed_with_observations"
        : "completed",
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    durationMs: finished.getTime() - started.getTime(),
    totalCostUsd: roundCost(steps.reduce((sum, s) => sum + (s.costUsd ?? 0), 0)),
    roles: opts.team.roles.map((r) => r.id),
    steps,
    reviews,
  };

  writeFileSync(path.join(runDir, DELIVERY_FILE), renderDelivery(record));
  const { runDir: _omit, ...persisted } = record;
  writeFileSync(path.join(runDir, RUN_LOG_FILE), `${JSON.stringify(persisted, null, 2)}\n`);
  emit({ type: "run-end", record });
  return record;
}

/** Read a run.json back (used by tests and, later, `agent-rounds resume`). */
export function readRunLog(runDir: string): Omit<RunRecord, "runDir"> {
  return JSON.parse(readFileSync(path.join(runDir, RUN_LOG_FILE), "utf8"));
}

export function slugify(text: string, max = 40): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= max) return slug || "run";
  const cut = slug.slice(0, max);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash >= max / 2 ? cut.slice(0, lastDash) : cut).replace(/-+$/, "");
}

function defaultRunName(date: Date, request: string): string {
  const iso = date.toISOString(); // 2026-11-14T14:20:12.000Z
  const stamp = `${iso.slice(0, 10)}-${iso.slice(11, 19).replace(/:/g, "")}`;
  return `${stamp}-${slugify(request)}`;
}

function createRunDir(runsDir: string, name: string): string {
  const base = path.resolve(runsDir);
  mkdirSync(base, { recursive: true });
  let dir = path.join(base, name);
  for (let n = 2; existsSync(dir); n++) dir = path.join(base, `${name}-${n}`);
  mkdirSync(dir);
  return dir;
}

function roundCost(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
