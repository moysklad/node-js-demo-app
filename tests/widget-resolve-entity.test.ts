import assert from "node:assert/strict";
import test from "node:test";
import { resolveWidgetEntity } from "../frontend/src/pages/WidgetPage/lib/resolve-widget-entity";

test("resolveWidgetEntity мапит widget entry paths", () => {
  assert.equal(resolveWidgetEntity("/entry/widget-customerorder"), "customerorder");
  assert.equal(resolveWidgetEntity("/entry/widget-invoiceout"), "invoiceout");
  assert.equal(resolveWidgetEntity("/entry/iframe"), null);
});
