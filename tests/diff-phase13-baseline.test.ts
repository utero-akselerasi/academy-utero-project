import { describe, expect, it } from "vitest";

type CatalogEntry = { id: string; definition: Record<string, unknown> };
type Catalog = Record<string, CatalogEntry[]>;
const modulePath = "../scripts/diff-phase13-baseline.mjs";
const { CATEGORIES, captureEffectiveGrants, classifyFunctionDefinition, classifyPost0048Probe, classifyThreeWay, compareCatalogs, compareEffectiveGrantSnapshots, expectedTracking, normalizeCatalog, validateEffectiveGrantTarget, validateTargets, validateReplay0048Target, verifyTracking } = await import(modulePath) as {
  CATEGORIES: Record<string, string>;
  compareCatalogs: (left: Catalog, right: Catalog) => {
    differences: number;
    baselineProven: boolean;
    categories: Record<string, { changed: string[]; onlyProduction: string[]; classification: { missingInProduction: string[]; productionOnly: string[]; ownerRoleDrift: string[]; formattingOnly: string[]; ordinalOnly: string[]; definitionDrift: string[] } }>;
  };
  classifyThreeWay: (baseline: Catalog, current: Catalog, production: Catalog) => {
    baselineProven: boolean;
    totals: Record<"expectedBy0038to0048" | "productionDrift" | "unresolved", number>;
    categories: Record<string, Record<"expectedBy0038to0048" | "productionDrift" | "unresolved", string[]>>;
  };
  classifyPost0048Probe: (clean: Catalog, probe: Catalog) => {
    totals: Record<"legacyDrift" | "unresolved", number>;
    categories: Record<string, Record<"legacyDrift" | "unresolved", string[]>>;
  };
  validateTargets: (left: string, right: string) => string;
  validateReplay0048Target: (url: string) => void;
  expectedTracking: (finalVersion: string) => Array<{ version: string; filename: string; checksum: string }>;
  verifyTracking: (rows: Array<{ version: string; filename: string; checksum: string }>, finalVersion: string) => void;
  normalizeCatalog: (catalog: Catalog) => Catalog;
  classifyFunctionDefinition: (clean: Record<string, unknown>, probe: Record<string, unknown>) => string[];
  validateEffectiveGrantTarget: (url: string, target: string) => string;
  captureEffectiveGrants: (client: { query: (sql: string) => Promise<{ rows: unknown[] }> }, database: string, versions: string) => Promise<{ grants: unknown[] }>;
  compareEffectiveGrantSnapshots: (clean: Record<string, unknown>, probe: Record<string, unknown>) => { categories: Record<string, Array<{ id: string; privileges?: string[] }>> };
};

describe("baseline catalog diff", () => {
  const replay = "postgres://supabase_admin:secret@127.0.0.1:54322/postgres";
  const production = "postgres://postgres:secret@127.0.0.1:55439/phase13_current_prod";

  it("tidak membandingkan ACL mentah pada grants", () => {
    expect(CATEGORIES.grants).not.toContain("aclexplode");
  });

  it("mengubah tipe internal char menjadi text sebelum menyusun ID default grant", () => {
    expect(CATEGORIES.defaultGrants).toContain("d.defaclobjtype::text || '.'");
    expect(CATEGORIES.defaultGrants).not.toContain("d.defaclobjtype || '.'");
  });

  it("membandingkan effective grants untuk role aplikasi", () => {
    expect(CATEGORIES.grants).toContain("has_schema_privilege");
    expect(CATEGORIES.grants).toContain("has_table_privilege");
    expect(CATEGORIES.grants).toContain("has_sequence_privilege");
    expect(CATEGORIES.grants).toContain("has_function_privilege");
    expect(CATEGORIES.grants).toContain("('anon'),('authenticated'),('service_role')");
    expect(CATEGORIES.defaultGrants).toContain("pg_get_userbyid(a.grantee)");
  });

  it("menormalkan metadata catalog kolom dan ACL fungsi mentah", () => {
    const catalog = Object.fromEntries(Object.keys(CATEGORIES).map((name) => [name, []])) as Catalog;
    catalog.columns = [{ id: "utero_academy.t.c", definition: { data_type: "uuid", udt_catalog: "postgres", domain_catalog: null } }];
    catalog.functions = [{ id: "utero_academy.f()", definition: { definition: "sql", owner: "postgres", acl: "DEFAULT" } }];
    const normalized = normalizeCatalog(catalog);
    expect(normalized.columns[0].definition).toEqual({ data_type: "uuid" });
    expect(normalized.functions[0].definition).toEqual({ definition: "sql", owner: "postgres" });
  });

  it("memisahkan body, security, search_path, owner, ACL, dan formatting fungsi", () => {
    const definition = (header: string, body: string, owner = "postgres", acl = "DEFAULT") => ({
      owner, acl, definition: `${header}\nAS $function$\n${body}\n$function$`,
    });
    const clean = definition("CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql SET search_path TO 'utero_academy'", "BEGIN NULL; END;");
    expect(classifyFunctionDefinition(clean, { ...clean, acl: "{=X/postgres}" })).toEqual([]);
    expect(classifyFunctionDefinition(clean, definition("CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql SET search_path TO 'utero_academy'", "BEGIN NULL; END;", "supabase_admin"))).toEqual(["owner"]);
    expect(classifyFunctionDefinition(clean, definition("CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'", "BEGIN RAISE NOTICE 'x'; END;")))
      .toEqual(["body", "security", "searchPath"]);
    expect(classifyFunctionDefinition(clean, definition("CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql SET search_path TO 'utero_academy'", "BEGIN NULL; END;\n"))).toEqual(["formattingOnly"]);
  });

  it("capture grants menolak host salah dan tracker tidak lengkap", async () => {
    const clean = "postgres://supabase_admin:secret@127.0.0.1:54322/postgres";
    expect(validateEffectiveGrantTarget(clean, "clean48")).toBe("postgres");
    expect(() => validateEffectiveGrantTarget(clean.replace("127.0.0.1", "localhost"), "clean48")).toThrow();
    expect(() => validateEffectiveGrantTarget(clean, "prod48probe")).toThrow();
    const queries: string[] = [];
    const client = { query: async (sql: string) => {
      queries.push(sql);
      return { rows: sql.includes("current_database()") ? [{ name: "postgres" }] : [] };
    } };
    await expect(captureEffectiveGrants(client, "postgres", "all")).rejects.toThrow(/Tracker/);
    expect(queries.at(-1)).toBe("ROLLBACK");
  });

  it("memisahkan revoke hardening, grant wajib hilang, dan grant probe berlebih", () => {
    const cleanTracking = expectedTracking("0048");
    const hash = async (rows: unknown[]) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(rows)))))
      .map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return Promise.all([hash(cleanTracking), hash(cleanTracking.filter(({ version }) => version >= "0038"))]).then(([cleanHash, probeHash]) => {
      const grants = (service: boolean, app: boolean, excess: boolean) => [
        { id: "relation.private.anon", definition: { effective: true, select: false } },
        { id: "relation.app.authenticated", definition: { effective: true, select: app, delete: excess } },
        { id: "relation.app.service_role", definition: { effective: true, select: service } },
      ];
      const result = compareEffectiveGrantSnapshots(
        { database: "postgres", trackerSha256: cleanHash, grants: grants(true, true, false) },
        { database: "phase13_prod_0048_probe_20261013", trackerSha256: probeHash, grants: grants(false, false, true) },
      );
      expect(result.categories.restricted).toContainEqual({ id: "relation.private.anon", privileges: ["select"] });
      expect(result.categories.applicationMissing).toContainEqual({ id: "relation.app.authenticated", privileges: ["select"] });
      expect(result.categories.serviceRoleMissing).toContainEqual({ id: "relation.app.service_role", privileges: ["select"] });
      expect(result.categories.probeExcess).toContainEqual({ id: "relation.app.authenticated", privileges: ["delete"] });
    });
  });

  it("hanya menerima replay CLI dan clone production lokal pada port terpisah", () => {
    expect(validateTargets(replay, production)).toBe("postgres");
    expect(() => validateTargets(replay.replace("127.0.0.1", "supabase.carubra.space"), production)).toThrow();
    expect(() => validateTargets(replay, production.replace("phase13_current_prod", "postgres"))).toThrow();
    expect(() => validateTargets(replay.replace(":54322", ":55439"), production)).toThrow();
    expect(() => validateTargets(replay.replace("supabase_admin", "postgres"), production)).toThrow();
    expect(() => validateTargets(replay, production.replace("postgres:secret", "supabase_admin:secret"))).toThrow();
    expect(() => validateTargets(replay, production.replace("127.0.0.1", "localhost"))).toThrow();
    expect(() => validateTargets(replay, production + "?sslmode=require")).toThrow();
  });

  it("hanya menerima capture replay 0048 pada stack CLI lokal", () => {
    const replay0048 = "postgres://supabase_admin:secret@127.0.0.1:54322/postgres";
    expect(() => validateReplay0048Target(replay0048)).not.toThrow();
    expect(() => validateReplay0048Target(replay0048.replace(":54322", ":55439"))).toThrow();
    expect(() => validateReplay0048Target(replay0048.replace("/postgres", "/phase13"))).toThrow();
  });

  it("menuntut tracker 43 dan 54 file persis beserta checksum", () => {
    const baseline = expectedTracking("0037");
    const current = expectedTracking("0048");
    expect(baseline).toHaveLength(43);
    expect(current).toHaveLength(54);
    expect(() => verifyTracking(baseline, "0037")).not.toThrow();
    expect(() => verifyTracking(current, "0048")).not.toThrow();
    expect(() => verifyTracking(baseline, "0048")).toThrow();
    expect(() => verifyTracking(current.map((row, index) => index === 53 ? { ...row, checksum: "wrong" } : row), "0048")).toThrow();
  });

  it("mendeteksi objek hilang dan berubah tanpa mengumumkan baseline terbukti", () => {
    const categories = ["relations", "columns", "constraints", "types", "functions", "triggers", "policies", "indexes", "grants", "defaultGrants", "storagePolicies", "storageBuckets", "platformOwners"];
    const left: Catalog = Object.fromEntries(categories.map((name) => [name, [] as CatalogEntry[]]));
    const right: Catalog = Object.fromEntries(categories.map((name) => [name, [] as CatalogEntry[]]));
    left.functions = [{ id: "utero_academy.test()", definition: { body: "a" } }];
    right.functions = [{ id: "utero_academy.test()", definition: { body: "b" } }];
    right.indexes = [{ id: "utero_academy.test_idx", definition: { ddl: "create index" } }];
    const result = compareCatalogs(left, right);
    expect(result.differences).toBe(2);
    expect(result.baselineProven).toBe(false);
    expect(result.categories.functions.changed).toEqual(["utero_academy.test()"]);
    expect(result.categories.indexes.onlyProduction).toEqual(["utero_academy.test_idx"]);
    expect(result.categories.functions.classification.definitionDrift).toEqual(["utero_academy.test()"]);
    expect(result.categories.indexes.classification.productionOnly).toEqual(["utero_academy.test_idx"]);
  });

  it("memisahkan perbedaan owner role platform dari drift definisi", () => {
    const categories = ["relations", "columns", "constraints", "types", "functions", "triggers", "policies", "indexes", "grants", "defaultGrants", "storagePolicies", "storageBuckets", "platformOwners"];
    const left: Catalog = Object.fromEntries(categories.map((name) => [name, []]));
    const right: Catalog = Object.fromEntries(categories.map((name) => [name, []]));
    left.platformOwners = [{ id: "storage.objects", definition: { owner: "supabase_storage_admin", kind: "r" } }];
    right.platformOwners = [{ id: "storage.objects", definition: { owner: "postgres", kind: "r" } }];
    const result = compareCatalogs(left, right);
    expect(result.baselineProven).toBe(false);
    expect(result.categories.platformOwners.classification.ownerRoleDrift).toEqual(["storage.objects"]);
    expect(result.categories.platformOwners.classification.definitionDrift).toEqual([]);
  });

  it("memisahkan formatting fungsi dan posisi kolom dari drift semantik", () => {
    const categories = Object.keys(CATEGORIES);
    const left: Catalog = Object.fromEntries(categories.map((name) => [name, []]));
    const right: Catalog = Object.fromEntries(categories.map((name) => [name, []]));
    left.functions = [{ id: "utero_academy.test()", definition: { owner: "postgres", definition: "CREATE FUNCTION utero_academy.test() RETURNS void LANGUAGE plpgsql AS $function$\r\nBEGIN\r\n  RETURN;\r\nEND;\r\n$function$\n" } }];
    right.functions = [{ id: "utero_academy.test()", definition: { owner: "postgres", definition: "CREATE FUNCTION utero_academy.test() RETURNS void LANGUAGE plpgsql AS $function$\nBEGIN\n  RETURN;\nEND;\n$function$\n" } }];
    left.columns = [{ id: "utero_academy.test.value", definition: { data_type: "text", ordinal_position: 2, dtd_identifier: "2" } }];
    right.columns = [{ id: "utero_academy.test.value", definition: { data_type: "text", ordinal_position: 3, dtd_identifier: "3" } }];
    const result = compareCatalogs(left, right);
    expect(result.differences).toBe(2);
    expect(result.categories.functions.classification.formattingOnly).toEqual(["utero_academy.test()"]);
    expect(result.categories.columns.classification.ordinalOnly).toEqual(["utero_academy.test.value"]);
    expect(result.categories.functions.classification.definitionDrift).toEqual([]);
    expect(result.categories.columns.classification.definitionDrift).toEqual([]);
  });

  it("mengklasifikasikan delta tiga-arah secara konservatif", () => {
    const categories = Object.keys(CATEGORIES);
    const makeCatalog = (): Catalog => Object.fromEntries(categories.map((name) => [name, []]));
    const baseline = makeCatalog();
    const current = makeCatalog();
    const productionCatalog = makeCatalog();
    baseline.policies = [{ id: "expected", definition: { using: "old" } }, { id: "drift", definition: { using: "same" } }, { id: "conflict", definition: { using: "old" } }];
    current.policies = [{ id: "expected", definition: { using: "new" } }, { id: "drift", definition: { using: "same" } }, { id: "conflict", definition: { using: "migration" } }];
    productionCatalog.policies = [{ id: "expected", definition: { using: "new" } }, { id: "drift", definition: { using: "production" } }, { id: "conflict", definition: { using: "production" } }];
    baseline.functions = [{ id: "f()", definition: { owner: "supabase_admin", body: "same" } }];
    current.functions = [{ id: "f()", definition: { owner: "supabase_admin", body: "same" } }];
    productionCatalog.functions = [{ id: "f()", definition: { owner: "postgres", body: "same" } }];
    const result = classifyThreeWay(baseline, current, productionCatalog);
    expect(result.baselineProven).toBe(false);
    expect(result.categories.policies.expectedBy0038to0048).toEqual(["expected"]);
    expect(result.categories.policies.productionDrift).toEqual(["drift"]);
    expect(result.categories.policies.unresolved).toEqual(["conflict"]);
    expect(result.categories.functions.unresolved).toEqual(["f()"]);
    expect(result.totals).toEqual({ expectedBy0038to0048: 1, productionDrift: 1, unresolved: 2 });
  });

  it("menahan raw ACL grants sebagai unresolved sampai effective snapshot tersedia", () => {
    const makeCatalog = (): Catalog => Object.fromEntries(Object.keys(CATEGORIES).map((name) => [name, []]));
    const baseline = makeCatalog();
    const current = makeCatalog();
    const productionCatalog = makeCatalog();
    baseline.grants = current.grants = [{ id: "relation.t.authenticated.SELECT", definition: { grantable: false } }];
    productionCatalog.grants = [];
    expect(classifyThreeWay(baseline, current, productionCatalog).categories.grants.unresolved)
      .toEqual(["relation.t.authenticated.SELECT"]);
  });

  it("mengisolasi legacy drift sesudah kedua sisi mendapat 0038–0048", () => {
    const makeCatalog = (): Catalog => Object.fromEntries(Object.keys(CATEGORIES).map((name) => [name, []]));
    const clean = makeCatalog();
    const probe = makeCatalog();
    clean.policies = [{ id: "policy", definition: { using: "clean" } }];
    probe.policies = [{ id: "policy", definition: { using: "legacy" } }];
    clean.grants = [{ id: "relation.t.authenticated.SELECT", definition: { grantable: false } }];
    const result = classifyPost0048Probe(clean, probe);
    expect(result.categories.policies.legacyDrift).toEqual(["policy"]);
    expect(result.categories.grants.unresolved).toEqual(["relation.t.authenticated.SELECT"]);
    expect(result.totals).toEqual({ legacyDrift: 1, unresolved: 1 });
  });

  it("menolak snapshot parsial dan ID duplikat agar selisih tidak tersembunyi", () => {
    expect(() => compareCatalogs({}, {})).toThrow(/tidak lengkap/);
    const categories = ["relations", "columns", "constraints", "types", "functions", "triggers", "policies", "indexes", "grants", "defaultGrants", "storagePolicies", "storageBuckets", "platformOwners"];
    const catalog: Catalog = Object.fromEntries(categories.map((name) => [name, []]));
    const entry = { id: "duplicate", definition: {} };
    catalog.policies = [entry, entry];
    expect(() => compareCatalogs(catalog, catalog)).toThrow(/ganda/);
  });
});
