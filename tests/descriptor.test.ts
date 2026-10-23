import assert from "node:assert/strict";
import test from "node:test";
import { SCENARIO_ACTIONS } from "../src/scenario/domain/scenario-event";
import { buildDescriptorXml } from "../src/utils/descriptor";

test("главный iframe и окно чатов включают user-context и отключают устаревший contextKey", () => {
  const descriptor = buildDescriptorXml();
  const iframes = descriptor.slice(descriptor.indexOf("<iframes>"), descriptor.indexOf("</iframes>"));

  assert.match(iframes, /<iframe type="main" sourceUrl="[^"]+\/entry\/iframe" useContextKey="false">/);
  assert.match(iframes, /<iframe type="chat" sourceUrl="[^"]+\/entry\/iframe-chat" useContextKey="false">/);
  assert.equal(iframes.match(/<uses>\s*<user-context\/>\s*<\/uses>/g)?.length, 2);
  assert.doesNotMatch(iframes, /<useContextKey>/);
});

test("дескриптор объявляет те же действия в сценариях, что обрабатывает решение", () => {
  const descriptor = buildDescriptorXml();
  const scenario = descriptor.slice(descriptor.indexOf("<scenario>"), descriptor.indexOf("</scenario>"));

  for (const [name, title] of Object.entries(SCENARIO_ACTIONS)) {
    assert.ok(scenario.includes(`<action name="${name}" title="${title}"/>`), name);
  }
});
