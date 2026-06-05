import assert from "node:assert/strict";
import test from "node:test";
import { parsePopupParams } from "../frontend/src/pages/PopupPage/lib/parsers";

test("parsePopupParams возвращает object payload", () => {
  assert.deepEqual(parsePopupParams(JSON.stringify({ mode: "copy", id: 10 })), {
    mode: "copy",
    id: 10,
  });
});

test("parsePopupParams отбрасывает не-object payload", () => {
  assert.deepEqual(parsePopupParams(JSON.stringify(["copy"])), {});
  assert.deepEqual(parsePopupParams("invalid-json"), {});
});
