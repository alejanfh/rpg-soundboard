// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { adventures } from "@/adventures";
import { sounds } from "@/sound-library";
import { validateContent } from "./validate-content";

describe("real content", () => {
  it("passes every integrity rule", () => {
    const errors = validateContent(sounds, adventures, (publicPath) =>
      fs.existsSync(path.join(process.cwd(), "public", publicPath)),
    );
    expect(errors).toEqual([]);
  });
});
