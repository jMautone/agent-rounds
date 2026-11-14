import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import path from "node:path";

export const VERDICTS = ["APPROVED", "CHANGES"] as const;
export type Verdict = (typeof VERDICTS)[number];

/** Files the OS drops into folders on its own; never blamed on a role. */
const IGNORED_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

/** Relative POSIX path → content hash. Symlinks are hashed by target, never followed. */
export type Snapshot = Map<string, string>;

export type ContractId = "writes-exist" | "writes-only-own-files" | "verdict-line";

export interface Violation {
  contract: ContractId;
  message: string;
}

export function snapshot(dir: string): Snapshot {
  const out: Snapshot = new Map();
  const walk = (abs: string, rel: string[]) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (IGNORED_NAMES.has(entry.name)) continue;
      const childAbs = path.join(abs, entry.name);
      const childRel = [...rel, entry.name];
      const key = childRel.join("/");
      const stat = lstatSync(childAbs);
      if (stat.isSymbolicLink()) {
        out.set(key, `link:${readlinkSync(childAbs)}`);
      } else if (stat.isDirectory()) {
        walk(childAbs, childRel);
      } else if (stat.isFile()) {
        out.set(key, createHash("sha256").update(readFileSync(childAbs)).digest("hex"));
      }
    }
  };
  walk(dir, []);
  return out;
}

export interface SnapshotDiff {
  added: string[];
  modified: string[];
  removed: string[];
}

export function diffSnapshots(before: Snapshot, after: Snapshot): SnapshotDiff {
  const added: string[] = [];
  const modified: string[] = [];
  const removed: string[] = [];
  for (const [file, hash] of after) {
    const old = before.get(file);
    if (old === undefined) added.push(file);
    else if (old !== hash) modified.push(file);
  }
  for (const file of before.keys()) if (!after.has(file)) removed.push(file);
  return { added: added.sort(), modified: modified.sort(), removed: removed.sort() };
}

/** True if `file` is one of `writes`, or sits under a folder entry ("dir/"). */
export function isCoveredBy(file: string, writes: readonly string[]): boolean {
  return writes.some((w) => (w.endsWith("/") ? file.startsWith(w) : file === w));
}

/** Contract 1: every declared write exists and is not empty. */
export function checkWritesExist(
  runDir: string,
  writes: readonly string[],
  after: Snapshot,
): Violation[] {
  const violations: Violation[] = [];
  for (const w of writes) {
    if (w.endsWith("/")) {
      const hasContent = [...after.keys()].some((f) => f.startsWith(w) && fileSize(runDir, f) > 0);
      if (!hasContent) {
        violations.push({ contract: "writes-exist", message: `folder ${w} is missing or empty` });
      }
    } else if (!after.has(w)) {
      violations.push({ contract: "writes-exist", message: `${w} was not written` });
    } else if (fileSize(runDir, w) === 0) {
      violations.push({ contract: "writes-exist", message: `${w} is empty` });
    }
  }
  return violations;
}

/** Contract 2: the role changed nothing outside its own writes. */
export function checkWritesOnlyOwnFiles(
  diff: SnapshotDiff,
  writes: readonly string[],
): Violation[] {
  const describe = (kind: string, files: string[]) =>
    files
      .filter((f) => !isCoveredBy(f, writes))
      .map((f) => ({
        contract: "writes-only-own-files" as const,
        message: `${kind} ${f}, which is not in its writes`,
      }));
  return [
    ...describe("created", diff.added),
    ...describe("modified", diff.modified),
    ...describe("deleted", diff.removed),
  ];
}

/**
 * Contract 3: the last non-blank line of a critique is exactly APPROVED or CHANGES.
 * Trailing blank lines and surrounding spaces are tolerated; anything else is not.
 */
export function readVerdict(
  runDir: string,
  file: string,
): { verdict?: Verdict; violation?: Violation } {
  let text: string;
  try {
    text = readFileSync(path.join(runDir, ...file.split("/")), "utf8");
  } catch {
    return { violation: { contract: "verdict-line", message: `${file} could not be read` } };
  }
  const last = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .at(-1);
  if (last === "APPROVED" || last === "CHANGES") return { verdict: last };
  return {
    violation: {
      contract: "verdict-line",
      message: `last line of ${file} must be APPROVED or CHANGES, got ${last === undefined ? "nothing" : JSON.stringify(truncate(last, 60))}`,
    },
  };
}

function fileSize(runDir: string, rel: string): number {
  try {
    return lstatSync(path.join(runDir, ...rel.split("/"))).size;
  } catch {
    return 0;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
