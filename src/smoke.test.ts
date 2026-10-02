import { describe, expect, it } from "vitest";
import { TWO } from "@/smoke";

describe("smoke", () => {
  it("runs the test runner and resolves the @/ alias", () => {
    expect(1 + 1).toBe(TWO);
  });
});
