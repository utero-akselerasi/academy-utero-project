import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../next.config";
import { UPLOAD_SIZE_LIMITS } from "../lib/uploads";

const nextConfig = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");
const nginxConfig = readFileSync(resolve(process.cwd(), "nginx.conf"), "utf8");
const registrationAction = readFileSync(resolve(process.cwd(), "features/registration/actions.ts"), "utf8");

describe("upload request body limit", () => {
  it("keeps combined CV and portfolio uploads within Next and nginx limits", () => {
    expect(registrationAction).toMatch(/validateUpload\(cvFile, \["document", "image"\]\)/);
    expect(registrationAction).toMatch(/validateUpload\(portfolioFile, \["document", "image"\]\)/);
    expect(nextConfig).toMatch(/bodySizeLimit:\s*"128mb"/);
    expect(nextConfig).toMatch(/proxyClientMaxBodySize:\s*"128mb"/);
    expect(nginxConfig).toMatch(/client_max_body_size\s+128m;/);
  });

  it("allows ten maximum-size daily report documents plus text and multipart overhead", () => {
    const requestLimit = 128 * 1024 * 1024;
    const attachmentsSize = 10 * UPLOAD_SIZE_LIMITS.document;
    const textSize = 4 * 20_000 * 3;
    const multipartAllowance = 1024 * 1024;

    expect(config.experimental?.serverActions).toEqual({ bodySizeLimit: "128mb" });
    expect(config.experimental?.proxyClientMaxBodySize).toBe("128mb");
    expect(attachmentsSize + textSize + multipartAllowance).toBeLessThan(requestLimit);
  });
});
