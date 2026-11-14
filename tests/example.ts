import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The versioned example run under examples/design-team/runs/. */
export const EXAMPLE = {
  dir: path.join(root, "examples", "design-team"),
  runName: "2026-11-14-onboarding-mate-and-co",
  request: "Design two onboarding screens for the Mate & Co. mobile app.",
  fixedDate: new Date("2026-11-14T12:00:00.000Z"),
};
