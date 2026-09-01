import assert from "node:assert/strict";
import test from "node:test";
import { mergeVisibleRects } from "../src/features/entry/ui/visible-area-math";

test("mergeVisibleRects spans from the first visible sentinel to the last", () => {
  assert.deepEqual(
    mergeVisibleRects([
      { top: 1240, bottom: 1280 },
      { top: 1280, bottom: 1440 },
      { top: 1440, bottom: 1600 },
      { top: 1600, bottom: 1712.4 }
    ]),
    { top: 1240, height: 472 }
  );
});

test("mergeVisibleRects returns null when nothing is visible", () => {
  assert.equal(mergeVisibleRects([]), null);
});
