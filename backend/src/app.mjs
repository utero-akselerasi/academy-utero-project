import Fastify from "fastify";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { loadIdentity } from "./auth/identity.mjs";
import { authRoutes } from "./routes/auth.mjs";
import { storageRoutes } from "./routes/storage.mjs";
import { profileRoutes } from "./routes/profiles.mjs";
import { registrationRoutes } from "./routes/registration.mjs";
import { tasksRoutes } from "./routes/tasks.mjs";
import { lmsRoutes } from "./routes/lms.mjs";
import { attendanceRoutes } from "./routes/attendance.mjs";
import { dailyReportRoutes } from "./routes/daily-reports.mjs";
import { cmsRoutes } from "./routes/cms.mjs";
import { assessmentsRoutes } from "./routes/assessments.mjs";
import { certificatesRoutes } from "./routes/certificates.mjs";
import { schoolRoutes } from "./routes/school.mjs";
import { superAdminRoutes } from "./routes/super-admin.mjs";
import { adminRoutes } from "./routes/admin.mjs";
import { selectionStaffRoutes } from "./routes/selection-staff.mjs";
import { checkReadiness } from "./readiness.mjs";

export async function buildApp({ db, config }) {
  const app = Fastify({ logger: true, trustProxy: config.trustProxy, bodyLimit: 1024 * 1024 });
  await app.register(multipart, { throwFileSizeLimit: true });
  await app.register(rateLimit, { global: false });

  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => {
    if (request.url.startsWith("/health/")) return;
    request.identity = await loadIdentity(db, request, config.sessionCookie);
  });

  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async (_request, reply) => {
    try {
      await checkReadiness(db, config.storageRoot);
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "not_ready" });
    }
  });

  await app.register(authRoutes, { db, config });
  await app.register(profileRoutes, { db });
  await app.register(registrationRoutes, { db });
  await app.register(tasksRoutes, { db });
  await app.register(lmsRoutes, { db });
  await app.register(attendanceRoutes, { db, config });
  await app.register(dailyReportRoutes, { db, config });
  await app.register(cmsRoutes, { db });
  await app.register(assessmentsRoutes, { db });
  await app.register(certificatesRoutes, { db, config });
  await app.register(schoolRoutes, { db, config });
  await app.register(superAdminRoutes, { db, config });
  await app.register(adminRoutes, { db });
  await app.register(selectionStaffRoutes, { db });
  await app.register(storageRoutes, { db, config });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    reply.code(status).send({ error: status === 500 ? "internal_error" : error.code || "request_error" });
  });
  return app;
}
