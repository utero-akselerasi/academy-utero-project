import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const actions = readFileSync(new URL("../features/lms/actions.ts", import.meta.url), "utf8");
const queries = readFileSync(new URL("../features/lms/queries.ts", import.meta.url), "utf8");
const certificates = readFileSync(new URL("../features/lms/certificate-helper.ts", import.meta.url), "utf8");

function body(source: string, name: string, nextName?: string) {
  const start = source.indexOf(`export async function ${name}`);
  const end = nextName ? source.indexOf(`export async function ${nextName}`, start + 1) : source.length;
  expect(start).toBeGreaterThanOrEqual(0);
  return source.slice(start, end < 0 ? source.length : end);
}

describe("LMS local backend boundary", () => {
  it.each([
    ["uploadLessonAttachmentAction", "deleteLessonAttachmentAction"],
    ["deleteLessonAttachmentAction", "markLessonCompletedAction"],
    ["toggleQuizPublishAction", "submitAssignmentAction"],
    ["createQuizAction", "createCommentAction"],
  ])("%s memilih backend lokal sebelum Supabase", (name, nextName) => {
    const source = body(actions, name, nextName);
    expect(source.indexOf("if (usesLocalBackend())")).toBeGreaterThanOrEqual(0);
    const firstSupabase = [source.indexOf("createUteroAcademyServiceRoleClient"), source.indexOf("createSupabaseServiceRoleClient")]
      .filter((index) => index >= 0)
      .sort((left, right) => left - right)[0];
    expect(source.indexOf("if (usesLocalBackend())")).toBeLessThan(firstSupabase);
  });

  it("internIsEnrolled memakai endpoint backend sebelum client Supabase", () => {
    const source = body(queries, "internIsEnrolled", "getInternEnrollments");
    expect(source.indexOf("usesLocalBackend()")).toBeLessThan(source.indexOf("createUteroAcademyServiceRoleClient"));
    expect(source).toContain("/enrollment?internId=");
  });

  it("generateCourseCertificate memakai endpoint backend sebelum client Supabase", () => {
    const source = body(certificates, "generateCourseCertificate");
    expect(source.indexOf("usesLocalBackend()")).toBeLessThan(source.indexOf("createUteroAcademyServiceRoleClient"));
    expect(source).toContain("/certificate");
  });
});
