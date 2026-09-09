import assert from "node:assert/strict";
import { test } from "node:test";
import { pageDataJson } from "../src/lib/http/page-data";

test("pageDataJson экранирует закрывающий тег script и разделители строк", () => {
  const json = pageDataJson({ message: "</script><script>alert(1)</script>", line: "a\u2028b" });

  assert.doesNotMatch(json, /<\/script>/i);
  assert.doesNotMatch(json, /\u2028/);
  assert.deepEqual(JSON.parse(json), { message: "</script><script>alert(1)</script>", line: "a\u2028b" });
});
