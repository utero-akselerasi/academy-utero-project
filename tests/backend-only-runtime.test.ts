import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

async function source(file: string) {
  return readFile(path.join(root, file), "utf8");
}

describe("backend-only runtime", () => {
  it("tidak memakai pemilih runtime atau env Supabase pada jalur build", async () => {
    const [mode, server, proxy, security, workflow, dockerfile] = await Promise.all([
      source("lib/backend/mode.ts"),
      source("lib/backend/server.ts"),
      source("proxy.ts"),
      source("lib/security-headers.ts"),
      source(".github/workflows/ci.yml"),
      source("Dockerfile.selfhosted"),
    ]);

    expect(mode).toContain("return true");
    expect(server).toContain("return true");
    expect(proxy).not.toContain("supabase/middleware");
    expect(security).not.toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(workflow).not.toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(workflow).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(dockerfile).not.toContain("ACADEMY_BACKEND_MODE");
  });
});
