import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "features/admin/dashboard-queries.ts"), "utf8");

describe("admin dashboard query", () => {
  it("menggunakan task_cards yang tersedia dan tidak menelan error Supabase", () => {
    expect(source).not.toContain('.from("tasks")');
    expect(source).toContain('.from("task_cards")');
    expect(source).toContain('task_lists!inner(name)');
    expect(source).toContain("if (failed?.error) throw failed.error");
  });
});
