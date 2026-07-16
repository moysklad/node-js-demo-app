import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../src/lib/config/config";
import { buildDescriptorXml } from "../src/utils/descriptor";

test("descriptor selects loyalty iframe when LoyaltyAPI is enabled", () => {
  const original = config.loyaltyApiEnabled;
  config.loyaltyApiEnabled = true;
  const descriptor = buildDescriptorXml();
  config.loyaltyApiEnabled = original;

  assert.match(descriptor, /<loyaltyApi\/>/);
  assert.match(descriptor, /<sourceUrl>.*\/entry\/loyalty<\/sourceUrl>/);
});

test("descriptor selects regular iframe when LoyaltyAPI is disabled", () => {
  const original = config.loyaltyApiEnabled;
  config.loyaltyApiEnabled = false;
  const descriptor = buildDescriptorXml();
  config.loyaltyApiEnabled = original;

  assert.doesNotMatch(descriptor, /<loyaltyApi\/>/);
  assert.match(descriptor, /<sourceUrl>.*\/entry\/iframe<\/sourceUrl>/);
});
