import path from "node:path";
import { costReported } from "./core/delivery.js";
import type { RunEvent, RunRecord, StepRecord } from "./core/runner.js";

/** One line per step, then a summary. Pure functions so tests can check the text. */
export function formatEvent(event: RunEvent, cwd = process.cwd()): string | null {
  switch (event.type) {
    case "run-start":
      return `agent-rounds · team ${event.team} · agent ${event.agent}\n→ ${relative(cwd, event.runDir)}`;
    case "step-end":
      return formatStep(event.step);
    case "review-exhausted":
      return `  ⚠ ${event.review.critic} still asks for changes after ${event.review.rounds} rounds; moving on with observations`;
    default:
      return null;
  }
}

export function formatStep(s: StepRecord): string {
  const mark = s.status === "ok" ? "✓" : "✗";
  const round = s.kind === "critic" || s.round > 1 ? ` round ${s.round}` : "";
  const verdict = s.verdict ? ` → ${s.verdict}` : "";
  const lines = [`${mark} ${s.role}${round}${verdict}`];
  if (s.error) lines.push(`    agent failed: ${s.error}`);
  for (const v of s.violations) lines.push(`    contract ${v.contract}: ${v.message}`);
  return lines.join("\n");
}

export function formatSummary(run: RunRecord, cwd = process.cwd()): string {
  const broken = run.steps.reduce((n, s) => n + s.violations.length, 0);
  const reviewRounds = run.reviews.reduce((n, r) => n + r.rounds, 0);
  const cost = costReported(run)
    ? `US$ ${run.totalCostUsd.toFixed(2)}${run.agent === "mock" ? " (mock)" : ""}`
    : `cost not reported (${run.agent})`;
  const parts = [
    plural(run.roles.length, "role"),
    plural(run.steps.length, "step"),
    plural(reviewRounds, "review round"),
    plural(broken, "broken contract"),
    cost,
    `${(run.durationMs / 1000).toFixed(1)}s`,
  ];
  const head =
    run.status === "failed"
      ? "✗ run failed"
      : run.status === "completed_with_observations"
        ? "⚠ done, with observations"
        : "✓ done";
  return `\n${head}: ${parts.join(" · ")}\n→ ${relative(cwd, path.join(run.runDir, "90-delivery.md"))}`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function relative(cwd: string, p: string): string {
  const rel = path.relative(cwd, p);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : p;
}
