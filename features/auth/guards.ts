import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type RoleCode, userHasAnyRole } from "./roles";
import { redirect } from "next/navigation";

type AuthenticatedUser = {
  id: string;
  email?: string | null;
};

export class RouteAuthorizationError extends Error {
  constructor(readonly status: 401 | 403) {
    super(status === 401 ? "Authentication required." : "Forbidden.");
  }
}

async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireRole(allowedRoles: RoleCode[]): Promise<AuthenticatedUser> {
  const user = await requireUser();

  if (!(await userHasAnyRole(user.id, allowedRoles))) {
    redirect("/dashboard/forbidden");
  }

  return user;
}

export async function requireAdmin(): Promise<AuthenticatedUser> {
  return requireRole(["admin", "super_admin"]);
}

export async function requireSuperAdmin(): Promise<AuthenticatedUser> {
  return requireRole(["super_admin"]);
}

/** Dashboard peserta. super_admin ikut diizinkan untuk keperluan dukungan. */
export async function requireIntern(): Promise<AuthenticatedUser> {
  return requireRole(["intern", "super_admin"]);
}

/** Dashboard sekolah. super_admin ikut diizinkan untuk keperluan dukungan. */
export async function requireSchool(): Promise<AuthenticatedUser> {
  return requireRole(["school", "super_admin"]);
}

export async function requireRouteUser(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new RouteAuthorizationError(401);
  }

  return user;
}

export async function requireRouteRole(allowedRoles: RoleCode[]): Promise<AuthenticatedUser> {
  const user = await requireRouteUser();

  if (!(await userHasAnyRole(user.id, allowedRoles))) {
    throw new RouteAuthorizationError(403);
  }

  return user;
}

export async function requireRouteAdmin(): Promise<AuthenticatedUser> {
  return requireRouteRole(["admin", "super_admin"]);
}

export async function requireRouteSuperAdmin(): Promise<AuthenticatedUser> {
  return requireRouteRole(["super_admin"]);
}
