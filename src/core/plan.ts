import { ROUND_PLACEHOLDER, type Role, type Team } from "./team.js";

/**
 * A segment is one authoring role plus, optionally, the critic that reviews it.
 * The runner executes segments in team.yaml order. Inside a segment it loops:
 * author → critic → (CHANGES) author → critic … up to the critic's max_rounds.
 */
export interface Segment {
  author: Role;
  critic?: Role;
}

export function buildPlan(team: Team): Segment[] {
  const segments: Segment[] = [];
  for (const role of team.roles) {
    if (role.criticOf === undefined) {
      segments.push({ author: role });
      continue;
    }
    const last = segments.at(-1);
    // team.ts guarantees a critic sits right after its author; keep the check
    // so a hand-built Team cannot silently produce a wrong plan.
    if (!last || last.author.id !== role.criticOf || last.critic) {
      throw new Error(`critic "${role.id}" must come right after "${role.criticOf}"`);
    }
    last.critic = role;
  }
  return segments;
}

/** The concrete paths a role must write in a given round. */
export function writesFor(role: Role, round: number): string[] {
  return role.writes.map((w) => w.split(ROUND_PLACEHOLDER).join(String(round)));
}

/** The single critique file a critic writes in a given round. */
export function critiqueFile(critic: Role, round: number): string {
  const [file] = writesFor(critic, round);
  if (file === undefined) throw new Error(`critic "${critic.id}" has no writes`);
  return file;
}
