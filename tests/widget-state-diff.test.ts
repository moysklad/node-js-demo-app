import assert from "node:assert/strict";
import { test } from "node:test";
import { diffState, formatDiffs } from "../src/features/entry/widget/client/object-state-diff";

test("diffState находит новые, измененные и удаленные поля objectState", () => {
  const diff = diffState({ name: "1", sum: 10, agent: { id: "a" } }, { name: "2", agent: { id: "a" }, moment: "now" });

  assert.deepEqual([...diff.entries()], [
    ["name", "2"],
    ["moment", "now"],
    ["sum", "<deleted>"]
  ]);
  assert.equal(formatDiffs(diff), "objectState changes:\nname = 2\nmoment = now\nsum = <deleted>");
  assert.equal(formatDiffs(new Map()), "objectState: no changes");
});
