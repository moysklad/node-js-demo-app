import assert from "node:assert/strict";
import test from "node:test";
import {
  diffState,
  formatDiffs,
  parseUpdatePayload,
  parseValidationFeedbackInput,
} from "../frontend/src/pages/WidgetPage/lib/protocol";

test("parseValidationFeedbackInput понимает structured payload", () => {
  const result = parseValidationFeedbackInput(
    JSON.stringify({
      valid: true,
      message: "ok",
      correlationId: 42,
    })
  );

  assert.deepEqual(result, {
    valid: true,
    message: "ok",
    changeMessageId: 42,
  });
});

test("parseValidationFeedbackInput использует строку как текст ошибки", () => {
  const result = parseValidationFeedbackInput(JSON.stringify("Ошибка валидации"));

  assert.deepEqual(result, {
    valid: false,
    message: "Ошибка валидации",
  });
});

test("parseUpdatePayload возвращает объект только для object payload", () => {
  assert.deepEqual(parseUpdatePayload(JSON.stringify({ foo: "bar" })), { foo: "bar" });
  assert.deepEqual(parseUpdatePayload(JSON.stringify(["foo"])), {});
  assert.deepEqual(parseUpdatePayload("invalid-json"), {});
});

test("diffState находит изменения и удаления", () => {
  const result = diffState(
    {
      same: 1,
      changed: "before",
      removed: true,
      nested: { foo: "bar" },
    },
    {
      same: 1,
      changed: "after",
      added: 7,
      nested: { foo: "bar" },
    }
  );

  assert.deepEqual(Array.from(result.entries()), [
    ["changed", "after"],
    ["added", 7],
    ["removed", "<deleted>"],
  ]);
});

test("formatDiffs форматирует пустой и непустой diff", () => {
  assert.equal(formatDiffs(new Map()), "objectState: no changes");
  assert.equal(
    formatDiffs(
      new Map<string, unknown>([
        ["foo", "bar"],
        ["nested", { ok: true }],
      ])
    ),
    "objectState changes:\nfoo = bar\nnested = {...}"
  );
});
