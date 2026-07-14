import assert from "node:assert/strict";
import test from "node:test";
import { buildDescriptorXml } from "../src/utils/descriptor";

test("descriptor declares loyalty settings support without a local provider route", () => {
  const descriptor = buildDescriptorXml();

  assert.match(descriptor, /<loyaltyApi\/>/);
  assert.match(descriptor, /<vendorApi>/);
  assert.match(descriptor, /<iframe>/);
});
