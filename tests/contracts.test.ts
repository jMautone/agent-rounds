import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkWritesExist,
  checkWritesOnlyOwnFiles,
  diffSnapshots,
  isCoveredBy,
  readVerdict,
  snapshot,
} from "../src/core/contracts.js";
import { tempDir } from "./helpers.js";

function put(dir: string, rel: string, content = "x") {
  const abs = path.join(dir, ...rel.split("/"));
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

describe("snapshot and diff", () => {
  it("sees added, modified and removed files, with POSIX keys in subfolders", () => {
    const dir = tempDir();
    put(dir, "keep.md");
    put(dir, "change.md", "v1");
    put(dir, "gone.md");
    const before = snapshot(dir);
    put(dir, "change.md", "v2");
    rmSync(path.join(dir, "gone.md"));
    put(dir, "sub/new.html");
    put(dir, ".DS_Store");
    expect(diffSnapshots(before, snapshot(dir))).toEqual({
      added: ["sub/new.html"],
      modified: ["change.md"],
      removed: ["gone.md"],
    });
  });
});

describe("isCoveredBy", () => {
  it("matches exact files and folder entries", () => {
    expect(isCoveredBy("a.md", ["a.md"])).toBe(true);
    expect(isCoveredBy("proto/css/x.css", ["proto/"])).toBe(true);
    expect(isCoveredBy("proto-other/x", ["proto/"])).toBe(false);
    expect(isCoveredBy("b.md", ["a.md"])).toBe(false);
  });
});

describe("contract 1: writes exist and are not empty", () => {
  it("flags missing and empty files", () => {
    const dir = tempDir();
    put(dir, "empty.md", "");
    const v = checkWritesExist(dir, ["missing.md", "empty.md"], snapshot(dir));
    expect(v.map((x) => x.message)).toEqual(["missing.md was not written", "empty.md is empty"]);
  });

  it("needs at least one non-empty file in a folder write", () => {
    const dir = tempDir();
    put(dir, "proto/empty.html", "");
    expect(checkWritesExist(dir, ["proto/"], snapshot(dir))[0]?.message).toBe(
      "folder proto/ is missing or empty",
    );
    put(dir, "proto/index.html", "<p>hi</p>");
    expect(checkWritesExist(dir, ["proto/"], snapshot(dir))).toEqual([]);
  });
});

describe("contract 2: a role only touches its own writes", () => {
  it("lists every file created, modified or deleted outside the writes", () => {
    const v = checkWritesOnlyOwnFiles(
      { added: ["mine.md", "theirs.md"], modified: ["00-request.md"], removed: ["10-x.md"] },
      ["mine.md"],
    );
    expect(v.map((x) => x.message)).toEqual([
      "created theirs.md, which is not in its writes",
      "modified 00-request.md, which is not in its writes",
      "deleted 10-x.md, which is not in its writes",
    ]);
  });
});

describe("contract 3: the verdict is the last line", () => {
  it.each([
    ["Notes\n\nAPPROVED\n", "APPROVED"],
    ["Notes\r\nCHANGES\r\n\r\n", "CHANGES"],
    ["  APPROVED  ", "APPROVED"],
  ])("reads %j", (text, verdict) => {
    const dir = tempDir();
    put(dir, "c.md", text);
    expect(readVerdict(dir, "c.md")).toEqual({ verdict });
  });

  it.each([
    ["APPROVED\nbut one more thing", '"but one more thing"'],
    ["approved", '"approved"'],
    ["**APPROVED**", '"**APPROVED**"'],
    ["Verdict: CHANGES", '"Verdict: CHANGES"'],
    ["\n\n", "nothing"],
  ])("rejects %j", (text, got) => {
    const dir = tempDir();
    put(dir, "c.md", text);
    const { verdict, violation } = readVerdict(dir, "c.md");
    expect(verdict).toBeUndefined();
    expect(violation?.message).toBe(`last line of c.md must be APPROVED or CHANGES, got ${got}`);
  });

  it("reports an unreadable critique", () => {
    expect(readVerdict(tempDir(), "nope.md").violation?.message).toBe("nope.md could not be read");
  });
});
