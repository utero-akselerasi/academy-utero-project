import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSchool: vi.fn(), listUsers: vi.fn(), invite: vi.fn(), from: vi.fn(), redirect: vi.fn(), revalidate: vi.fn(),
}));

vi.mock("@/features/school-applications/queries", () => ({ requireActiveSchoolPartner: mocks.requireSchool }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({ auth: { admin: { listUsers: mocks.listUsers, inviteUserByEmail: mocks.invite } } }),
  createUteroAcademyServiceRoleClient: async () => ({ from: mocks.from }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const { retryApplicantInvitationAction } = await import("../features/school-applications/actions") as {
  retryApplicantInvitationAction(formData: FormData): Promise<void>;
};

function form(id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa") {
  const data = new FormData();
  data.set("applicationId", id);
  return data;
}

function setup(application: { id: string; email: string; full_name: string; source: string; applicant_user_id: string | null } | null) {
  const scoped: { eq: ReturnType<typeof vi.fn>; maybeSingle: ReturnType<typeof vi.fn> } = {
    eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: application, error: null }),
  };
  const updateSingle = vi.fn().mockResolvedValue({ data: { id: application?.id, applicant_user_id: "user-1" }, error: null });
  const updateChain = { eq: vi.fn(), is: vi.fn(), select: vi.fn(), maybeSingle: updateSingle };
  updateChain.eq.mockReturnValue(updateChain);
  updateChain.is.mockReturnValue(updateChain);
  updateChain.select.mockReturnValue(updateChain);
  const builder = { select: vi.fn().mockReturnValue(scoped), update: vi.fn().mockReturnValue(updateChain) };
  scoped.eq.mockReturnValue(scoped);
  const userRoles = { select: vi.fn(), insert: vi.fn(), delete: vi.fn() };
  const roleRead = { eq: vi.fn(), returns: vi.fn().mockResolvedValue({ data: [], error: null }) };
  roleRead.eq.mockReturnValue(roleRead);
  userRoles.select.mockReturnValue(roleRead);
  const roleInsert = { select: vi.fn(), single: vi.fn().mockResolvedValue({ data: { id: "assignment-1" }, error: null }) };
  roleInsert.select.mockReturnValue(roleInsert);
  userRoles.insert.mockReturnValue(roleInsert);
  const roleLookup = { eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "applicant-role" }, error: null }) };
  roleLookup.eq.mockReturnValue(roleLookup);
  const userProfiles = { insert: vi.fn().mockResolvedValue({ error: null }) };
  mocks.from.mockImplementation((table: string) => table === "user_roles" ? userRoles : table === "roles" ? { select: () => roleLookup } : table === "user_profiles" ? userProfiles : builder);
  return { scoped, builder, updateChain, userRoles, roleRead, userProfiles };
}

describe("retryApplicantInvitationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSchool.mockResolvedValue({ school: { id: "school-1" }, userId: "school-user" });
    mocks.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
  });

  it("menolak ID invalid sebelum akses privileged", async () => {
    await retryApplicantInvitationAction(form("invalid"));
    expect(mocks.requireSchool).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/school/applications?invite=failed");
  });

  it("menolak aplikasi milik sekolah lain tanpa invite", async () => {
    setup(null);
    await retryApplicantInvitationAction(form());
    expect(mocks.invite).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/school/applications?invite=failed");
  });

  it("menautkan akun existing tanpa mengirim undangan duplikat", async () => {
    const { builder, scoped, roleRead, userProfiles } = setup({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email: "person@example.com", full_name: "Person", source: "school", applicant_user_id: null });
    roleRead.returns.mockResolvedValue({ data: [{ roles: { code: "applicant" } }], error: null });
    mocks.listUsers.mockResolvedValue({ data: { users: [{ id: "user-1", email: "PERSON@example.com" }] }, error: null });
    await retryApplicantInvitationAction(form());
    expect(scoped.eq).toHaveBeenCalledWith("school_id", "school-1");
    expect(userProfiles.insert).toHaveBeenCalledWith({ id: "user-1", full_name: "Person", is_active: true });
    expect(builder.update).toHaveBeenCalledWith({ applicant_user_id: "user-1" });
    expect(mocks.invite).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/school/applications?invite=linked");
  });

  it("idempoten bila sudah tertaut", async () => {
    setup({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email: "person@example.com", full_name: "Person", source: "school", applicant_user_id: "user-1" });
    await retryApplicantInvitationAction(form());
    expect(mocks.listUsers).not.toHaveBeenCalled();
    expect(mocks.invite).not.toHaveBeenCalled();
  });

  it("mengirim undangan hanya bila email belum memiliki akun", async () => {
    const { roleRead } = setup({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email: "person@example.com", full_name: "Person", source: "school", applicant_user_id: null });
    roleRead.returns.mockResolvedValue({ data: [{ roles: { code: "applicant" } }], error: null });
    mocks.invite.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    await retryApplicantInvitationAction(form());
    expect(mocks.invite).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/school/applications?invite=sent");
  });

  it("gagal tertutup jika lookup akun gagal", async () => {
    setup({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email: "person@example.com", full_name: "Person", source: "school", applicant_user_id: null });
    mocks.listUsers.mockResolvedValue({ data: null, error: { message: "failed" } });
    await retryApplicantInvitationAction(form());
    expect(mocks.invite).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/school/applications?invite=failed");
  });

  it("memprovisi role applicant bagi akun existing tanpa role sebelum link", async () => {
    const { builder, roleRead, userRoles } = setup({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email: "person@example.com", full_name: "Person", source: "school", applicant_user_id: null });
    roleRead.returns.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: [{ roles: { code: "applicant" } }], error: null });
    mocks.listUsers.mockResolvedValue({ data: { users: [{ id: "user-1", email: "person@example.com" }] }, error: null });
    await retryApplicantInvitationAction(form());
    expect(userRoles.insert).toHaveBeenCalledWith({ user_id: "user-1", role_id: "applicant-role" });
    expect(builder.update).toHaveBeenCalledWith({ applicant_user_id: "user-1" });
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/school/applications?invite=linked");
  });

  it("menolak akun intern atau staf tanpa menautkan atau mengubah role", async () => {
    const { builder, roleRead, userRoles, userProfiles } = setup({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email: "person@example.com", full_name: "Person", source: "school", applicant_user_id: null });
    roleRead.returns.mockResolvedValue({ data: [{ roles: { code: "intern" } }], error: null });
    mocks.listUsers.mockResolvedValue({ data: { users: [{ id: "user-1", email: "person@example.com" }] }, error: null });
    await retryApplicantInvitationAction(form());
    expect(userRoles.insert).not.toHaveBeenCalled();
    expect(userProfiles.insert).not.toHaveBeenCalled();
    expect(builder.update).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/school/applications?invite=role-conflict");
  });

  it("tidak overwrite profil existing dan tetap menautkan pada konflik unik", async () => {
    const { builder, roleRead, userProfiles } = setup({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email: "person@example.com", full_name: "Nama dari aplikasi", source: "school", applicant_user_id: null });
    roleRead.returns.mockResolvedValue({ data: [{ roles: { code: "applicant" } }], error: null });
    userProfiles.insert.mockResolvedValue({ error: { code: "23505" } });
    mocks.listUsers.mockResolvedValue({ data: { users: [{ id: "user-1", email: "person@example.com" }] }, error: null });
    await retryApplicantInvitationAction(form());
    expect(userProfiles.insert).toHaveBeenCalledTimes(1);
    expect(builder.update).toHaveBeenCalledWith({ applicant_user_id: "user-1" });
  });

  it("gagal tertutup bila profil minimal tidak dapat dibuat", async () => {
    const { builder, roleRead, userProfiles } = setup({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email: "person@example.com", full_name: "Person", source: "school", applicant_user_id: null });
    roleRead.returns.mockResolvedValue({ data: [{ roles: { code: "applicant" } }], error: null });
    userProfiles.insert.mockResolvedValue({ error: { code: "42501" } });
    mocks.listUsers.mockResolvedValue({ data: { users: [{ id: "user-1", email: "person@example.com" }] }, error: null });
    await retryApplicantInvitationAction(form());
    expect(builder.update).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/school/applications?invite=failed");
  });
});
