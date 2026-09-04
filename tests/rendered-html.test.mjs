import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the intended private-preview metadata and worker security policy", async () => {
  const [layout, worker] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../dist/server/index.js", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /codex-preview/);
  assert.match(layout, /CardWise/);
  assert.match(worker, /Content-Security-Policy/);
  assert.match(worker, /X-Content-Type-Options/);
  assert.match(worker, /Cross-Origin-Opener-Policy/);
});
