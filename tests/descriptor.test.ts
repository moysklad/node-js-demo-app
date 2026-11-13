import assert from "node:assert/strict";
import test from "node:test";
import { SCENARIO_ACTIONS } from "../src/scenario/domain/scenario-event";
import { config } from "../src/lib/config/config";
import { buildDescriptorXml } from "../src/utils/descriptor";

test("по умолчанию endpoint дескриптора использует адрес приложения", () => {
  const descriptor = buildDescriptorXml();

  assert.ok(descriptor.includes(`<endpointBase>${config.appBaseUrl}/vendor-endpoint</endpointBase>`));
});

test("отдельный endpoint не меняет адреса iframe, виджетов и popup и экранируется в XML", () => {
  const descriptor = buildDescriptorXml("https://callback.example.test/vendor-endpoint?tenant=demo&mode=test");
  const sourceUrls = [...descriptor.matchAll(/sourceUrl="([^"]+)"|<sourceUrl>([^<]+)<\/sourceUrl>/g)]
    .map((match) => match[1] ?? match[2]);

  assert.ok(descriptor.includes("<endpointBase>https://callback.example.test/vendor-endpoint?tenant=demo&#38;mode=test</endpointBase>"));
  assert.deepEqual(sourceUrls, [
    `${config.appBaseUrl}/entry/iframe`,
    `${config.appBaseUrl}/entry/iframe-chat`,
    `${config.appBaseUrl}/entry/iframe-mobile`,
    `${config.appBaseUrl}/entry/widget-customerorder`,
    `${config.appBaseUrl}/entry/widget-invoiceout`,
    `${config.appBaseUrl}/entry/popup`
  ]);
});

test("главный iframe и окно чатов включают user-context и отключают устаревший contextKey", () => {
  const descriptor = buildDescriptorXml();
  const iframes = descriptor.slice(descriptor.indexOf("<iframes>"), descriptor.indexOf("</iframes>"));

  assert.match(iframes, /<iframe type="main" sourceUrl="[^"]+\/entry\/iframe" useContextKey="false">/);
  assert.match(iframes, /<iframe type="chat" sourceUrl="[^"]+\/entry\/iframe-chat" useContextKey="false">/);
  assert.equal(iframes.match(/<uses>\s*<user-context\/>\s*<\/uses>/g)?.length, 2);
  assert.doesNotMatch(iframes, /<useContextKey>/);
  assert.match(iframes, /<iframe type="mobile" sourceUrl="[^"]+\/entry\/iframe-mobile"\/>/);
});

test("дескриптор объявляет те же действия в сценариях, что обрабатывает решение", () => {
  const descriptor = buildDescriptorXml();
  const scenario = descriptor.slice(descriptor.indexOf("<scenario>"), descriptor.indexOf("</scenario>"));

  for (const [name, title] of Object.entries(SCENARIO_ACTIONS)) {
    assert.ok(scenario.includes(`<action name="${name}" title="${title}"/>`), name);
  }
});
