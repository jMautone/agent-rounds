import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { isMap, isSeq, LineCounter, type Node, parseDocument } from "yaml";
import { z } from "zod";

/** File names the runner owns. No role may list them in `writes`. */
export const REQUEST_FILE = "00-request.md";
export const DELIVERY_FILE = "90-delivery.md";
export const RUN_LOG_FILE = "run.json";
export const RESERVED_FILES = [REQUEST_FILE, DELIVERY_FILE, RUN_LOG_FILE] as const;

export const ROUND_PLACEHOLDER = "{round}";
export const DEFAULT_MAX_ROUNDS = 2;
export const MAX_MAX_ROUNDS = 5;

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * A path inside the run folder (or, for `prompt`, next to team.yaml).
 * Always written with forward slashes in team.yaml; must not escape its base.
 */
const relativePath = z
  .string()
  .min(1)
  .refine((p) => !path.posix.isAbsolute(p) && !path.win32.isAbsolute(p), {
    message: "must be a relative path",
  })
  .refine((p) => !p.includes("\\"), { message: "use forward slashes (/) in paths" })
  .refine((p) => !p.split("/").some((seg) => seg === ".." || seg === "."), {
    message: "must not contain '.' or '..' segments",
  });

const roleSchema = z
  .object({
    id: z.string().regex(ID_PATTERN, "must be lowercase letters, digits and dashes"),
    prompt: relativePath,
    reads: z.array(relativePath).default([]),
    writes: z.array(relativePath).min(1, "a role must write at least one file"),
    critic_of: z.string().optional(),
    max_rounds: z.number().int().min(1).max(MAX_MAX_ROUNDS).optional(),
  })
  .strict();

const teamSchema = z
  .object({
    name: z.string().regex(ID_PATTERN, "must be lowercase letters, digits and dashes"),
    roles: z.array(roleSchema).min(1, "a team needs at least one role"),
  })
  .strict()
  .superRefine((team, ctx) => {
    const seen = new Map<string, number>();
    const writers = new Map<string, string>();

    team.roles.forEach((role, i) => {
      const at = (...rest: (string | number)[]) => ["roles", i, ...rest];

      if (seen.has(role.id)) {
        ctx.addIssue({ code: "custom", path: at("id"), message: `duplicate role id "${role.id}"` });
      }
      seen.set(role.id, i);

      role.writes.forEach((w, j) => {
        const bare = w.replace(/\/$/, "");
        if ((RESERVED_FILES as readonly string[]).includes(bare)) {
          ctx.addIssue({
            code: "custom",
            path: at("writes", j),
            message: `"${bare}" is owned by the runner`,
          });
        }
        const owner = writers.get(w);
        if (owner !== undefined && owner !== role.id) {
          ctx.addIssue({
            code: "custom",
            path: at("writes", j),
            message: `"${w}" is already written by role "${owner}"`,
          });
        }
        writers.set(w, role.id);
      });

      if (role.critic_of === undefined) {
        if (role.max_rounds !== undefined) {
          ctx.addIssue({
            code: "custom",
            path: at("max_rounds"),
            message: "max_rounds only applies to critics (roles with critic_of)",
          });
        }
        role.writes.forEach((w, j) => {
          if (w.includes(ROUND_PLACEHOLDER)) {
            ctx.addIssue({
              code: "custom",
              path: at("writes", j),
              message: `${ROUND_PLACEHOLDER} is only allowed in a critic's writes`,
            });
          }
        });
        return;
      }

      // Critic rules.
      const prev = team.roles[i - 1];
      if (!team.roles.some((r) => r.id === role.critic_of)) {
        ctx.addIssue({
          code: "custom",
          path: at("critic_of"),
          message: `unknown role "${role.critic_of}"`,
        });
      } else if (prev === undefined || prev.id !== role.critic_of) {
        ctx.addIssue({
          code: "custom",
          path: at("critic_of"),
          message: `a critic must come right after the role it reviews ("${role.critic_of}")`,
        });
      } else if (prev.critic_of !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: at("critic_of"),
          message: "a critic cannot review another critic",
        });
      }
      const [only, ...extra] = role.writes;
      if (extra.length > 0 || only === undefined || !only.includes(ROUND_PLACEHOLDER)) {
        ctx.addIssue({
          code: "custom",
          path: at("writes"),
          message: `a critic writes exactly one file whose name contains ${ROUND_PLACEHOLDER}, e.g. 30-critique-${ROUND_PLACEHOLDER}.md`,
        });
      } else if (only.endsWith("/")) {
        ctx.addIssue({
          code: "custom",
          path: at("writes", 0),
          message: "a critique must be a file, not a folder",
        });
      }
    });
  });

export type RoleConfig = z.infer<typeof roleSchema>;

export interface Role {
  id: string;
  /** Absolute path to the role prompt (.md). */
  promptPath: string;
  reads: string[];
  /** May contain {round} (critics only) and folder entries ending in "/". */
  writes: string[];
  criticOf?: string;
  maxRounds: number;
}

export interface Team {
  name: string;
  /** Absolute path of team.yaml. */
  file: string;
  roles: Role[];
}

export interface TeamIssue {
  line: number;
  column: number;
  path: string;
  message: string;
}

export class TeamError extends Error {
  constructor(
    readonly file: string,
    readonly issues: TeamIssue[],
  ) {
    const shown = displayPath(file);
    super(
      [
        `Invalid team file ${shown}:`,
        ...issues.map(
          (i) => `  ${shown}:${i.line}:${i.column}  ${i.path ? `${i.path}: ` : ""}${i.message}`,
        ),
      ].join("\n"),
    );
    this.name = "TeamError";
  }
}

/** Load, validate and normalize a team.yaml. Throws TeamError with line numbers. */
export function loadTeam(file: string): Team {
  const abs = path.resolve(file);
  if (!existsSync(abs)) {
    throw new TeamError(abs, [{ line: 1, column: 1, path: "", message: "file not found" }]);
  }
  return parseTeam(readFileSync(abs, "utf8"), abs);
}

/** Validate team.yaml source. `file` locates role prompts and is used in messages. */
export function parseTeam(source: string, file: string): Team {
  const lineCounter = new LineCounter();
  const doc = parseDocument(source, { lineCounter, prettyErrors: false });
  const locate = (offset: number) => {
    const pos = lineCounter.linePos(offset);
    return { line: pos.line, column: pos.col };
  };

  if (doc.errors.length > 0) {
    throw new TeamError(
      file,
      doc.errors.map((e) => {
        const at = locate(e.pos[0]);
        const line = source.split(/\r?\n/)[at.line - 1] ?? "";
        const hint = line.includes(ROUND_PLACEHOLDER)
          ? ` (quote paths that contain ${ROUND_PLACEHOLDER}: "30-critique-${ROUND_PLACEHOLDER}.md")`
          : "";
        return { ...at, path: "", message: `${e.message.split("\n")[0] ?? ""}${hint}` };
      }),
    );
  }

  const result = teamSchema.safeParse(doc.toJS());
  if (!result.success) {
    throw new TeamError(
      file,
      result.error.issues.map((issue) => ({
        ...locate(offsetFor(doc.contents, issue.path)),
        path: formatPath(issue.path),
        message: issue.message,
      })),
    );
  }

  const baseDir = path.dirname(file);
  const issues: TeamIssue[] = [];
  const roles: Role[] = result.data.roles.map((r, i) => {
    const promptPath = path.resolve(baseDir, ...r.prompt.split("/"));
    if (!existsSync(promptPath) || !statSync(promptPath).isFile()) {
      issues.push({
        ...locate(offsetFor(doc.contents, ["roles", i, "prompt"])),
        path: formatPath(["roles", i, "prompt"]),
        message: `prompt file not found: ${r.prompt}`,
      });
    }
    return {
      id: r.id,
      promptPath,
      reads: r.reads,
      writes: r.writes,
      ...(r.critic_of !== undefined ? { criticOf: r.critic_of } : {}),
      maxRounds: r.max_rounds ?? DEFAULT_MAX_ROUNDS,
    };
  });
  if (issues.length > 0) throw new TeamError(file, issues);

  return { name: result.data.name, file, roles };
}

/** Relative to the working directory when the file is inside it, so messages stay short. */
function displayPath(file: string): string {
  const rel = path.relative(process.cwd(), file);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : file;
}

function formatPath(p: readonly PropertyKey[]): string {
  return p
    .map((seg, i) => (typeof seg === "number" ? `[${seg}]` : `${i === 0 ? "" : "."}${String(seg)}`))
    .join("");
}

/** Source offset of the deepest YAML node that exists along `p`. */
function offsetFor(root: unknown, p: readonly PropertyKey[]): number {
  let node = root as Node | null | undefined;
  let offset = node?.range?.[0] ?? 0;
  for (const seg of p) {
    if (isMap(node)) {
      const pair = node.items.find((it) => (it.key as { value?: unknown } | null)?.value === seg);
      if (!pair) break;
      const keyNode = pair.key as Node | null;
      node = pair.value as Node | null;
      offset = node?.range?.[0] ?? keyNode?.range?.[0] ?? offset;
    } else if (isSeq(node) && typeof seg === "number") {
      const item = node.items[seg] as Node | undefined;
      if (!item) break;
      node = item;
      offset = item.range?.[0] ?? offset;
    } else {
      break;
    }
  }
  return offset;
}
