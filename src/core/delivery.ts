import type { RunRecord, StepRecord } from "./runner.js";
import { REQUEST_FILE, RUN_LOG_FILE } from "./team.js";

const STATUS_LABEL: Record<RunRecord["status"], string> = {
  completed: "✅ Completed",
  completed_with_observations: "⚠️ Completed with observations",
  failed: "❌ Failed: a contract was broken or an agent failed",
};

/**
 * 90-delivery.md, built from the run record with a fixed template and no LLM.
 * It leaves out dates and durations on purpose so a mock run is byte-for-byte
 * reproducible; those live in run.json.
 */
export function renderDelivery(run: Omit<RunRecord, "runDir">): string {
  const out: string[] = [];
  out.push(`# Delivery: ${run.team}`, "");
  out.push(...run.request.split("\n").map((l) => `> ${l}`), "");
  out.push(`**Status:** ${STATUS_LABEL[run.status]}  `);
  out.push(`**Agent:** ${run.agent}  `);
  out.push(`**Cost:** US$ ${run.totalCostUsd.toFixed(2)}`, "");

  out.push("## Steps", "");
  out.push("| # | Role | Round | Result | Files |", "| --- | --- | --- | --- | --- |");
  for (const s of run.steps) {
    out.push(
      `| ${s.index} | ${s.role} | ${s.round} | ${stepResult(s)} | ${s.writes.map(link).join(", ")} |`,
    );
  }
  out.push("");

  if (run.reviews.length > 0) {
    out.push("## Reviews", "");
    out.push("| Author | Critic | Rounds | Final verdict |", "| --- | --- | --- | --- |");
    for (const r of run.reviews) {
      const verdict = r.withObservations
        ? `${r.finalVerdict} (with observations)`
        : (r.finalVerdict ?? "none");
      out.push(`| ${r.author} | ${r.critic} | ${r.rounds} of ${r.maxRounds} | ${verdict} |`);
    }
    out.push("");
  }

  const observed = run.reviews.filter((r) => r.withObservations);
  if (observed.length > 0) {
    out.push("## Open observations", "");
    for (const r of observed) {
      const last = run.steps.filter((s) => s.role === r.critic).at(-1);
      const file = last?.writes[0];
      out.push(
        `- **${r.author}**: ${r.critic} still asked for changes after ${r.rounds} rounds${file ? ` (see ${link(file)})` : ""}.`,
      );
    }
    out.push("");
  }

  const broken = run.steps.filter((s) => s.status === "failed");
  if (broken.length > 0) {
    out.push("## What broke", "");
    for (const s of broken) {
      if (s.error) out.push(`- **${s.role}** round ${s.round}: agent failed: ${s.error}`);
      for (const v of s.violations) {
        out.push(`- **${s.role}** round ${s.round}: \`${v.contract}\`: ${v.message}`);
      }
    }
    out.push("");
  }

  out.push("## Files", "");
  const files = new Set<string>([REQUEST_FILE]);
  for (const s of run.steps) for (const w of s.writes) files.add(w);
  for (const f of files) out.push(`- ${link(f)}`);
  out.push(`- ${link(RUN_LOG_FILE)}`, "");
  return out.join("\n");
}

function stepResult(s: StepRecord): string {
  if (s.status === "failed") return "❌ failed";
  if (s.verdict === "CHANGES") return "🔁 CHANGES";
  return s.verdict ? `✅ ${s.verdict}` : "✅";
}

function link(file: string): string {
  return `[${file}](${encodeURI(file)})`;
}
