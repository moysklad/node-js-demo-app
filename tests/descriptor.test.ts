import assert from "node:assert/strict";
import test from "node:test";
import { buildDescriptorXml } from "../src/utils/descriptor";

test("дескриптор объявляет Loyalty API и единственный основной iframe", () => {
  const descriptor = buildDescriptorXml();

  // Элемент loyaltyApi только открывает решению право передавать настройки лояльности
  // через Vendor API и сам по себе программу лояльности в аккаунте не включает.
  assert.match(descriptor, /<loyaltyApi\/>/);

  assert.match(descriptor, /<sourceUrl>.*\/entry\/iframe<\/sourceUrl>/);
  assert.doesNotMatch(descriptor, /<sourceUrl>.*\/entry\/loyalty<\/sourceUrl>/);
});
