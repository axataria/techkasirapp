import assert from "node:assert/strict";
import test from "node:test";
import { parseCssTime } from "./src/lib/css-time.ts";

test("converts computed CSS times to WAAPI milliseconds", () => {
  for (const [input, expected] of [["180ms", 180], [".18s", 180], ["0ms", 0], ["0s", 0], ["  0.25s  ", 250]]) {
    assert.equal(parseCssTime(input), expected, input);
  }
});

test("falls back for invalid, negative, and overflowing durations", () => {
  for (const input of ["", " ", "-1ms", "180", "ms", "NaNs", "Infinityms", "180ms extra", "9".repeat(309) + "s"]) {
    assert.equal(parseCssTime(input), 180, input);
  }
});
