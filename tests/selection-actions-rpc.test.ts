import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const actions = fs.readFileSync(path.join(process.cwd(), "features/selection/actions.ts"), "utf8");

describe("selection decision action", () => {
  it("delegates the complete decision transition to the authenticated RPC", () => {
    const start = actions.indexOf("export async function decideSelectionAction");
    const end = actions.indexOf("export async function bypassSelectionAction", start);
    const source = actions.slice(start, end);

    expect(source).toContain("createUteroAcademyClient()");
    expect(source).toContain('db.rpc("decide_selection_atomically"');
    expect(source).not.toContain('from("selection_decisions")');
    expect(source).not.toContain('from("selection_assignments")');
    expect(source).not.toContain('from("internship_applications")');
    expect(source).not.toContain("writeAuditLog");
  });
});
