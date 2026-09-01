import assert from "node:assert/strict";
import test from "node:test";
import { buildDescriptorXml } from "../src/utils/descriptor";

test("главный iframe включает user-context и отключает устаревший contextKey", () => {
  const descriptor = buildDescriptorXml();
  const iframe = descriptor.slice(descriptor.indexOf("<iframe"), descriptor.indexOf("</iframe>") + 9);

  assert.match(iframe, /<iframe useContextKey="false">/);
  assert.match(iframe, /<uses>\s*<user-context\/>\s*<\/uses>/);
  assert.doesNotMatch(iframe, /<useContextKey>/);
});
