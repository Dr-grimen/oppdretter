import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Exercise just the real download function, with no network or main workflow.
const script = readFileSync(new URL("../scripts/snapshot.sh", import.meta.url), "utf8");
const hent = script.match(/^hent\(\) \{[\s\S]*?^\}/m)![0];

test("a failed same-day snapshot retry cannot retain an old gzip file as a successful source", t => {
  const dir = mkdtempSync(join(tmpdir(), "oppdretter-snapshot-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const curlStub of ["curl() { return 1; }", "curl() { printf '%s' '{\"error\":\"upstream\"}' > \"$UT/health.json\"; }"]) {
    writeFileSync(join(dir, "health.json.gz"), "old snapshot");
    const r = spawnSync("bash", ["-c", `${hent}\n${curlStub}\nhent health.json https://example.invalid\n`], {
      env: { ...process.env, UT: dir }, encoding: "utf8",
    });
    assert.equal(r.status, 1);
    assert.equal(existsSync(join(dir, "health.json.gz")), false);
    assert.equal(existsSync(join(dir, "health.json")), false);
  }
});
