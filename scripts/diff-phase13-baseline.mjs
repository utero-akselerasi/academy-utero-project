#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { historicalMigrations } from "./audit-phase13-baseline.mjs";

export const CATEGORIES = {
  relations: `select n.nspname || '.' || c.relname as id, jsonb_build_object('kind', c.relkind, 'owner', pg_get_userbyid(c.relowner), 'rls', c.relrowsecurity, 'forceRls', c.relforcerowsecurity, 'definition', case when c.relkind in ('v','m') then pg_get_viewdef(c.oid, true) else null end, 'options', c.reloptions) as definition from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='utero_academy' and c.relkind in ('r','p','v','m','S','f')`,
  columns: `select table_schema || '.' || table_name || '.' || column_name as id, to_jsonb(c) - array['table_catalog','udt_catalog','domain_catalog','scope_catalog','collation_catalog','character_set_catalog'] as definition from information_schema.columns c where table_schema='utero_academy'`,
  constraints: `select n.nspname || '.' || c.relname || '.' || x.conname as id, jsonb_build_object('type', x.contype, 'definition', pg_get_constraintdef(x.oid, true), 'validated', x.convalidated, 'deferred', x.condeferrable) as definition from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='utero_academy'`,
  types: `select n.nspname || '.' || t.typname as id, jsonb_build_object('type', t.typtype, 'labels', (select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid)) as definition from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='utero_academy' and t.typtype in ('e','d')`,
  functions: `select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as id, jsonb_build_object('definition', pg_get_functiondef(p.oid), 'owner', pg_get_userbyid(p.proowner)) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='utero_academy'`,
  triggers: `select n.nspname || '.' || c.relname || '.' || t.tgname as id, jsonb_build_object('definition', pg_get_triggerdef(t.oid, true), 'enabled', t.tgenabled) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='utero_academy' and not t.tgisinternal`,
  policies: `select schemaname || '.' || tablename || '.' || policyname as id, jsonb_build_object('command', cmd, 'roles', roles, 'permissive', permissive, 'using', qual, 'check', with_check) as definition from pg_policies where schemaname='utero_academy'`,
  indexes: `select schemaname || '.' || indexname as id, jsonb_build_object('definition', indexdef, 'valid', x.indisvalid, 'ready', x.indisready) as definition from pg_indexes i join pg_namespace n on n.nspname=i.schemaname join pg_class c on c.relnamespace=n.oid and c.relname=i.indexname join pg_index x on x.indexrelid=c.oid where schemaname='utero_academy'`,
  grants: `with roles(role_name) as (values ('anon'),('authenticated'),('service_role')) select 'schema.utero_academy.' || role_name as id, jsonb_build_object('effective',true,'usage',has_schema_privilege(role_name,'utero_academy','USAGE'),'create',has_schema_privilege(role_name,'utero_academy','CREATE')) as definition from roles union all select 'relation.' || c.relname || '.' || role_name, case when c.relkind='S' then jsonb_build_object('effective',true,'usage',has_sequence_privilege(role_name,c.oid,'USAGE'),'select',has_sequence_privilege(role_name,c.oid,'SELECT'),'update',has_sequence_privilege(role_name,c.oid,'UPDATE')) else jsonb_build_object('effective',true,'select',has_table_privilege(role_name,c.oid,'SELECT'),'insert',has_table_privilege(role_name,c.oid,'INSERT'),'update',has_table_privilege(role_name,c.oid,'UPDATE'),'delete',has_table_privilege(role_name,c.oid,'DELETE'),'truncate',has_table_privilege(role_name,c.oid,'TRUNCATE'),'references',has_table_privilege(role_name,c.oid,'REFERENCES'),'trigger',has_table_privilege(role_name,c.oid,'TRIGGER')) end from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join roles where n.nspname='utero_academy' and c.relkind in ('r','p','v','m','S','f') union all select 'function.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ').' || role_name, jsonb_build_object('effective',true,'execute',has_function_privilege(role_name,p.oid,'EXECUTE')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join roles where n.nspname='utero_academy'`,
  defaultGrants: `select r.rolname || '.' || coalesce(n.nspname,'*') || '.' || d.defaclobjtype::text || '.' || pg_get_userbyid(a.grantee) || '.' || a.privilege_type as id, jsonb_build_object('grantable',a.is_grantable) as definition from pg_default_acl d join pg_roles r on r.oid=d.defaclrole left join pg_namespace n on n.oid=d.defaclnamespace cross join lateral aclexplode(d.defaclacl) a where n.nspname='utero_academy'`,
  storagePolicies: `select schemaname || '.' || tablename || '.' || policyname as id, jsonb_build_object('command',cmd,'roles',roles,'permissive',permissive,'using',qual,'check',with_check) as definition from pg_policies where schemaname='storage'`,
  storageBuckets: `select id::text as id, jsonb_build_object('public',public,'limit',file_size_limit,'mime',allowed_mime_types) as definition from storage.buckets`,
  platformOwners: `select n.nspname || '.' || c.relname as id, jsonb_build_object('owner', pg_get_userbyid(c.relowner), 'kind', c.relkind) as definition from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','storage') and c.relname in ('users','objects','buckets') and c.relkind in ('r','p')`,
};

export function validateTargets(replay, production) {
  const parse = (value, database, port, user) => {
    let url;
    try { url = new URL(value); } catch { throw new Error('URL database lokal wajib valid'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || url.port !== port ||
      url.search || url.hash || url.username !== user || !url.password || url.pathname !== `/${database}`)
      throw new Error(`Target DB harus 127.0.0.1:${port}/${database} dengan user ${user}`);
  };
  parse(replay, 'postgres', '54322', 'supabase_admin');
  parse(production, 'phase13_current_prod', '55439', 'postgres');
  return 'postgres';
}

export function validateReplay0048Target(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('URL replay 0048 wajib valid'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || url.port !== '54322' ||
    url.pathname !== '/postgres' || url.username !== 'supabase_admin' || !url.password || url.search || url.hash)
    throw new Error('Replay 0048 hanya boleh pada 127.0.0.1:54322/postgres memakai supabase_admin');
}

const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');

export function expectedTracking(finalVersion) {
  const filenames = readdirSync(migrationsDirectory);
  const migrations = finalVersion === '0037' ? historicalMigrations(filenames) : filenames.flatMap((filename) => {
    const match = /^(\d{4}[a-z]?)_.+\.sql$/.exec(filename);
    return match && match[1] <= '0048' ? [{ version: match[1], filename }] : [];
  }).sort((left, right) => left.version.localeCompare(right.version));
  const requiredCount = finalVersion === '0037' ? 43 : 54;
  if (!['0037', '0048'].includes(finalVersion) || migrations.length !== requiredCount ||
    migrations.at(-1)?.version !== finalVersion || new Set(migrations.map(({ version }) => version)).size !== migrations.length)
    throw new Error(`Daftar migrasi sampai ${finalVersion} tidak valid`);
  return migrations.map(({ version, filename }) => ({ version, filename,
    checksum: createHash('sha256').update(readFileSync(join(migrationsDirectory, filename))).digest('hex') }));
}

export function verifyTracking(actual, finalVersion) {
  if (JSON.stringify(actual) !== JSON.stringify(expectedTracking(finalVersion)))
    throw new Error(`Tracker replay tidak cocok dengan file dan checksum sampai ${finalVersion}`);
}

export function normalizeCatalog(catalog) {
  const normalized = Object.fromEntries(Object.entries(catalog).map(([category, rows]) => [category,
    rows.map(({ id, definition }) => ({ id, definition: { ...definition } }))]));
  const catalogFields = ['table_catalog', 'udt_catalog', 'domain_catalog', 'scope_catalog', 'collation_catalog', 'character_set_catalog'];
  for (const row of normalized.columns ?? []) for (const field of catalogFields) delete row.definition[field];
  for (const row of normalized.functions ?? []) delete row.definition.acl;
  const owners = new Map();
  for (const row of normalized.relations ?? []) owners.set(`relation.${row.id.split('.').at(-1)}`, row.definition.owner);
  for (const row of normalized.functions ?? []) owners.set(`function.${row.id.replace(/^utero_academy\./, '')}`, row.definition.owner);
  normalized.grants = (normalized.grants ?? []).filter(({ id, definition }) => {
    if (definition.effective === true) return true;
    for (const [prefix, owner] of owners) if (id.startsWith(`${prefix}.`) && id.slice(prefix.length + 1).startsWith(`${owner}.`)) return false;
    return ['anon', 'authenticated', 'service_role', 'unknown (OID=0)'].some((role) => id.includes(`.${role}.`));
  }).map((row) => ({ ...row, id: row.id.replace('.unknown (OID=0).', '.PUBLIC.') }));
  return normalized;
}

export function classifyFunctionDefinition(clean, probe) {
  if (!clean || !probe) return ['missingObject'];
  const result = [];
  if (clean.owner !== probe.owner) result.push('owner');
  const parse = (value) => {
    const source = value.definition ?? '';
    const match = /\bAS\s+(\$[A-Za-z_0-9]*\$)([\s\S]*?)\1\s*;?\s*$/i.exec(source);
    if (!match) return null;
    const header = source.slice(0, match.index);
    const searchPath = /\bSET\s+search_path\s+TO\s+([^\r\n]+)/i.exec(header)?.[1]?.trim() ?? null;
    return { body: match[2].replace(/\r\n/g, '\n').trim(),
      security: /\bSECURITY\s+DEFINER\b/i.test(header) ? 'definer' : 'invoker',
      searchPath, header: header.replace(/\bSET\s+search_path\s+TO\s+[^\r\n]+/gi, '')
        .replace(/\bSECURITY\s+(DEFINER|INVOKER)\b/gi, '').replace(/\s+/g, ' ').trim() };
  };
  const left = parse(clean);
  const right = parse(probe);
  if (!left || !right) return [...result, 'unparsedDefinition'];
  if (left.body !== right.body) result.push('body');
  if (left.security !== right.security) result.push('security');
  if (left.searchPath !== right.searchPath) result.push('searchPath');
  if (left.header !== right.header) result.push('signatureOrAttributes');
  if (!result.length && clean.definition !== probe.definition) result.push('formattingOnly');
  return result;
}

export function classifyThreeWay(replay0037, replay0048, production) {
  replay0037 = normalizeCatalog(replay0037);
  replay0048 = normalizeCatalog(replay0048);
  production = normalizeCatalog(production);
  const baseline = compareCatalogs(replay0037, production);
  compareCatalogs(replay0037, replay0048);
  compareCatalogs(replay0048, production);
  const categories = {};
  const totals = { expectedBy0038to0048: 0, productionDrift: 0, unresolved: 0 };
  for (const category of Object.keys(CATEGORIES)) {
    const old = new Map(replay0037[category].map(({ id, definition }) => [id, JSON.stringify(definition)]));
    const next = new Map(replay0048[category].map(({ id, definition }) => [id, JSON.stringify(definition)]));
    const prod = new Map(production[category].map(({ id, definition }) => [id, JSON.stringify(definition)]));
    const result = { expectedBy0038to0048: [], productionDrift: [], unresolved: [] };
    const effectiveGrants = category !== 'grants' || [replay0037, replay0048, production].every((catalog) =>
      catalog.grants.every((row) => row.definition.effective === true));
    for (const id of new Set([...old.keys(), ...next.keys(), ...prod.keys()])) {
      const before = old.get(id);
      const after = next.get(id);
      const current = prod.get(id);
      if (before === current && after === current) continue;
      let label;
      const owners = [replay0037, replay0048, production].map((catalog) => catalog[category].find((row) => row.id === id)?.definition.owner);
      if (!effectiveGrants || category === 'platformOwners' || category === 'defaultGrants' || ['relations', 'functions'].includes(category) && new Set(owners).size > 1) {
        label = 'unresolved';
      } else if (before !== after && after === current) {
        label = 'expectedBy0038to0048';
      } else if (before === after && after !== current) {
        label = 'productionDrift';
      } else {
        label = 'unresolved';
      }
      result[label].push(id);
      totals[label]++;
    }
    categories[category] = result;
  }
  return { baselineProven: false, correctionMigrationProposed: false, baselineDifferences: baseline.differences,
    totals, categories, limitation: 'Klasifikasi katalog bukan bukti kausal migrasi; owner platform, kolom dan konflik tiga-arah perlu review manual.' };
}

export function classifyPost0048Probe(clean0048, productionProbe0048) {
  clean0048 = normalizeCatalog(clean0048);
  productionProbe0048 = normalizeCatalog(productionProbe0048);
  compareCatalogs(clean0048, productionProbe0048);
  const totals = { legacyDrift: 0, unresolved: 0 };
  const categories = {};
  const functionDetails = {};
  for (const category of Object.keys(CATEGORIES)) {
    const clean = new Map(clean0048[category].map(({ id, definition }) => [id, JSON.stringify(definition)]));
    const probe = new Map(productionProbe0048[category].map(({ id, definition }) => [id, JSON.stringify(definition)]));
    const result = { legacyDrift: [], unresolved: [] };
    const effectiveGrants = category !== 'grants' || [clean0048, productionProbe0048].every((catalog) =>
      catalog.grants.every((row) => row.definition.effective === true));
    for (const id of new Set([...clean.keys(), ...probe.keys()])) {
      if (clean.get(id) === probe.get(id)) continue;
      if (category === 'functions') {
        functionDetails[id] = classifyFunctionDefinition(
          clean0048.functions.find((row) => row.id === id)?.definition,
          productionProbe0048.functions.find((row) => row.id === id)?.definition,
        );
      }
      const cleanOwner = clean0048[category].find((row) => row.id === id)?.definition.owner;
      const probeOwner = productionProbe0048[category].find((row) => row.id === id)?.definition.owner;
      const unresolved = !effectiveGrants || category === 'functions' && functionDetails[id].includes('unparsedDefinition') ||
        ['defaultGrants', 'platformOwners'].includes(category) ||
        ['relations', 'functions'].includes(category) && cleanOwner !== probeOwner;
      const label = unresolved ? 'unresolved' : 'legacyDrift';
      result[label].push(id);
      totals[label]++;
    }
    categories[category] = result;
  }
  return { totals, categories, functionDetails, correctionMigrationProposed: false,
    limitation: 'Probe sesudah 0048 mengisolasi kandidat legacy drift, tetapi tidak membuktikan penyebab atau SQL koreksi.' };
}

export function classifyFiles(baselineFile, currentFile, productionFile, productionProbeFile) {
  const read = (filename) => {
    const bytes = readFileSync(filename);
    return { catalog: JSON.parse(bytes.toString('utf8')), sha256: createHash('sha256').update(bytes).digest('hex') };
  };
  const baseline = read(baselineFile);
  const current = read(currentFile);
  const production = read(productionFile);
  const report = classifyThreeWay(baseline.catalog, current.catalog, production.catalog);
  const output = { ...report, sources: {
    replay0037: { path: baselineFile, sha256: baseline.sha256, trackerVerified: false },
    replay0048: { path: currentFile, sha256: current.sha256, trackerVerified: false },
    productionClone: { path: productionFile, sha256: production.sha256, identityVerified: false },
  } };
  if (productionProbeFile) {
    const productionProbe = read(productionProbeFile);
    output.sources.productionProbe0048 = { path: productionProbeFile, sha256: productionProbe.sha256, trackerVerified: false };
    output.post0048Probe = classifyPost0048Probe(current.catalog, productionProbe.catalog);
  }
  return output;
}

export function validateEffectiveGrantTarget(value, target) {
  let url;
  try { url = new URL(value); } catch { throw new Error('URL capture lokal wajib valid'); }
  const expected = target === 'clean48'
    ? { port: '54322', database: 'postgres', user: 'supabase_admin' }
    : target === 'prod48probe'
      ? { port: '55439', database: 'phase13_prod_0048_probe_20261013', user: 'supabase_admin' }
      : null;
  if (!expected || !['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
    url.port !== expected.port || url.pathname !== `/${expected.database}` || url.username !== expected.user ||
    !url.password || url.search || url.hash) throw new Error('Capture hanya diizinkan pada clean48 atau prod48probe lokal');
  return expected.database;
}

export async function captureEffectiveGrants(client, expectedDatabase, expectedVersions) {
  await client.query('BEGIN READ ONLY');
  try {
    await client.query("SET LOCAL statement_timeout = '30s'");
    const identity = (await client.query('select current_database() as name')).rows[0];
    if (identity.name !== expectedDatabase) throw new Error('Identitas DB capture tidak cocok');
    const tracking = (await client.query('select version, filename, checksum from utero_academy.schema_migrations order by version')).rows;
    const expected = expectedTracking('0048').filter(({ version }) => expectedVersions === 'all' || version >= '0038');
    if (JSON.stringify(tracking) !== JSON.stringify(expected)) throw new Error('Tracker capture tidak cocok dengan migrasi 0048');
    const grants = (await client.query(`select * from (${CATEGORIES.grants}) catalog order by id`)).rows;
    return { database: expectedDatabase, trackerSha256: createHash('sha256').update(JSON.stringify(tracking)).digest('hex'), grants };
  } finally { await client.query('ROLLBACK'); }
}

export function compareEffectiveGrantSnapshots(cleanSnapshot, probeSnapshot) {
  const expectedHash = (suffix) => createHash('sha256').update(JSON.stringify(expectedTracking('0048').filter(({ version }) => !suffix || version >= '0038'))).digest('hex');
  for (const [snapshot, database, suffix] of [[cleanSnapshot, 'postgres', false], [probeSnapshot, 'phase13_prod_0048_probe_20261013', true]]) {
    if (snapshot?.database !== database || snapshot.trackerSha256 !== expectedHash(suffix) || !Array.isArray(snapshot.grants) ||
      snapshot.grants.some((row) => !row?.id || row.definition?.effective !== true) ||
      new Set(snapshot.grants.map(({ id }) => id)).size !== snapshot.grants.length)
      throw new Error(`Evidence effective grants ${database} tidak valid`);
  }
  const clean = new Map(cleanSnapshot.grants.map(({ id, definition }) => [id, definition]));
  const probe = new Map(probeSnapshot.grants.map(({ id, definition }) => [id, definition]));
  const categories = { serviceRoleMissing: [], applicationMissing: [], probeExcess: [], restricted: [], aligned: [], structural: [] };
  for (const id of [...new Set([...clean.keys(), ...probe.keys()])].sort()) {
    const before = clean.get(id);
    const after = probe.get(id);
    if (!before || !after) { categories.structural.push({ id, side: before ? 'clean48' : 'prod48probe' }); continue; }
    const privileges = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => key !== 'effective').sort();
    for (const [key, select] of [
      ['serviceRoleMissing', (privilege) => id.endsWith('.service_role') && before[privilege] === true && after[privilege] !== true],
      ['applicationMissing', (privilege) => !id.endsWith('.service_role') && before[privilege] === true && after[privilege] !== true],
      ['probeExcess', (privilege) => before[privilege] !== true && after[privilege] === true],
      ['restricted', (privilege) => !id.endsWith('.service_role') && before[privilege] !== true && after[privilege] !== true],
      ['aligned', (privilege) => before[privilege] === true && after[privilege] === true],
    ]) {
      const selected = privileges.filter(select);
      if (selected.length) categories[key].push({ id, privileges: selected });
    }
  }
  return { baselineProven: false, correctionMigrationProposed: false,
    sources: { clean48: cleanSnapshot.database, prod48probe: probeSnapshot.database },
    counts: Object.fromEntries(Object.entries(categories).map(([key, rows]) => [key, rows.length])), categories,
    limitation: 'Restricted privileges selaras deny-by-default 0031, bukan bukti sebab; tidak mengotorisasi GRANT otomatis.' };
}

export function compareCatalogs(replay, production) {
  replay = normalizeCatalog(replay);
  production = normalizeCatalog(production);
  const output = {};
  let differences = 0;
  for (const category of Object.keys(CATEGORIES)) {
    if (!Array.isArray(replay[category]) || !Array.isArray(production[category])) throw new Error(`Snapshot kategori ${category} tidak lengkap`);
    for (const rows of [replay[category], production[category]]) {
      if (rows.some((row) => !row || typeof row.id !== 'string' || !row.id || !row.definition || typeof row.definition !== 'object' || Array.isArray(row.definition)) ||
        new Set(rows.map(({ id }) => id)).size !== rows.length) throw new Error(`ID katalog ${category} tidak valid atau ganda`);
    }
    const left = new Map(replay[category].map(({ id, definition }) => [id, createHash('sha256').update(JSON.stringify(definition)).digest('hex')]));
    const right = new Map(production[category].map(({ id, definition }) => [id, createHash('sha256').update(JSON.stringify(definition)).digest('hex')]));
    const onlyReplay = [...left.keys()].filter((id) => !right.has(id)).sort();
    const onlyProduction = [...right.keys()].filter((id) => !left.has(id)).sort();
    const changed = [...left.keys()].filter((id) => right.has(id) && left.get(id) !== right.get(id)).sort();
    const ownerRoleDrift = changed.filter((id) => {
      const replayDefinition = replay[category].find((row) => row.id === id).definition;
      const productionDefinition = production[category].find((row) => row.id === id).definition;
      if (!['relations', 'functions', 'platformOwners'].includes(category) ||
        replayDefinition?.owner === productionDefinition?.owner) return false;
      const replayRest = { ...replayDefinition };
      const productionRest = { ...productionDefinition };
      delete replayRest.owner;
      delete productionRest.owner;
      return JSON.stringify(replayRest) === JSON.stringify(productionRest);
    });
    const formattingOnly = category === 'functions' ? changed.filter((id) => {
      const replayDefinition = replay[category].find((row) => row.id === id).definition;
      const productionDefinition = production[category].find((row) => row.id === id).definition;
      return classifyFunctionDefinition(replayDefinition, productionDefinition).every((reason) => reason === 'formattingOnly');
    }) : [];
    const ordinalOnly = category === 'columns' ? changed.filter((id) => {
      const replayDefinition = { ...replay[category].find((row) => row.id === id).definition };
      const productionDefinition = { ...production[category].find((row) => row.id === id).definition };
      delete replayDefinition.ordinal_position;
      delete replayDefinition.dtd_identifier;
      delete productionDefinition.ordinal_position;
      delete productionDefinition.dtd_identifier;
      return JSON.stringify(replayDefinition) === JSON.stringify(productionDefinition);
    }) : [];
    const explainedDrift = new Set([...ownerRoleDrift, ...formattingOnly, ...ordinalOnly]);
    output[category] = { replayCount: left.size, productionCount: right.size, onlyReplay, onlyProduction, changed,
      classification: { missingInProduction: onlyReplay, productionOnly: onlyProduction,
        ownerRoleDrift, formattingOnly, ordinalOnly,
        definitionDrift: changed.filter((id) => !explainedDrift.has(id)) } };
    differences += onlyReplay.length + onlyProduction.length + changed.length;
  }
  return { comparable: true, baselineProven: false, correctionMigrationProposed: false, differences, categories: output,
    limitation: 'Kesamaan katalog akhir tidak membuktikan urutan migrasi historis atau parity data dan perilaku.' };
}

export async function snapshot(client, expectedDatabase, { replayVersion } = {}) {
  await client.query('BEGIN READ ONLY');
  try {
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query('SET LOCAL search_path = pg_catalog');
    const identity = (await client.query(`select current_database() as name, to_regclass('auth.users') is not null as auth, to_regclass('storage.buckets') is not null as storage, to_regnamespace('utero_academy') is not null as academy`)).rows[0];
    if (identity.name !== expectedDatabase || !identity.auth || !identity.storage || !identity.academy) throw new Error('Identitas atau bootstrap platform tidak valid');
    if (replayVersion) {
      const { rows } = await client.query("select to_regclass('utero_academy.schema_migrations') is not null as tracked");
      if (!rows[0].tracked) throw new Error('Replay tidak punya tracker migrasi');
      const tracking = (await client.query('select version, filename, checksum from utero_academy.schema_migrations order by version')).rows;
      verifyTracking(tracking, replayVersion);
    }
    const catalog = {};
    for (const [name, sql] of Object.entries(CATEGORIES)) catalog[name] = (await client.query(`select * from (${sql}) catalog order by id`)).rows;
    return catalog;
  } finally { await client.query('ROLLBACK'); }
}

async function main() {
  if (process.argv[2] === '--compare-effective-grants' && process.argv.length === 5) {
    console.log(JSON.stringify(compareEffectiveGrantSnapshots(
      JSON.parse(readFileSync(process.argv[3], 'utf8')), JSON.parse(readFileSync(process.argv[4], 'utf8'))), null, 2));
    return;
  }
  if (['--effective-grants-clean48', '--effective-grants-probe'].includes(process.argv[2]) && process.argv.length === 3) {
    const target = process.argv[2] === '--effective-grants-clean48' ? 'clean48' : 'prod48probe';
    const connectionString = process.env.PHASE13_EFFECTIVE_GRANTS_DATABASE_URL;
    const expectedDatabase = validateEffectiveGrantTarget(connectionString, target);
    const { default: pg } = await import('pg');
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000,
      options: '-c default_transaction_read_only=on -c statement_timeout=30000' });
    try {
      await client.connect();
      console.log(JSON.stringify(await captureEffectiveGrants(client, expectedDatabase, target === 'clean48' ? 'all' : 'suffix'), null, 2));
    } finally { await client.end().catch(() => {}); }
    return;
  }
  if (process.argv[2] === '--three-way' && [6, 7].includes(process.argv.length)) {
    const report = classifyFiles(...process.argv.slice(3));
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.baselineDifferences ? 1 : 0;
    return;
  }
  if (process.argv[2] === '--snapshot-0048' && process.argv.length === 3) {
    const connectionString = process.env.PHASE13_REPLAY_0048_DATABASE_URL;
    validateReplay0048Target(connectionString);
    const { default: pg } = await import('pg');
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000,
      options: '-c default_transaction_read_only=on -c statement_timeout=30000' });
    try {
      await client.connect();
      const catalog = await snapshot(client, 'postgres', { replayVersion: '0048' });
      const trackerSha256 = createHash('sha256').update(JSON.stringify(expectedTracking('0048'))).digest('hex');
      console.log(JSON.stringify({ snapshotVersion: '0048', trackerSha256, catalog }, null, 2));
    } finally { await client.end().catch(() => {}); }
    return;
  }
  if (process.argv.length !== 2)
    throw new Error('Gunakan --snapshot-0048, --three-way <0037.json> <0048.json> <prod.json>, atau tanpa argumen');
  const replayUrl = process.env.PHASE13_REPLAY_DATABASE_URL;
  const productionUrl = process.env.PHASE13_CLONE_PROD_DATABASE_URL;
  const replayName = validateTargets(replayUrl, productionUrl);
  const { default: pg } = await import('pg');
  const clients = [replayUrl, productionUrl].map((connectionString) => new pg.Client({ connectionString, connectionTimeoutMillis: 5000,
    options: '-c default_transaction_read_only=on -c statement_timeout=30000' }));
  try {
    await clients[0].connect();
    const replayCatalog = await snapshot(clients[0], replayName, { replayVersion: '0037' });
    const productionClient = clients.at(-1);
    await productionClient.connect();
    const productionCatalog = await snapshot(productionClient, 'phase13_current_prod');
    const report = compareCatalogs(replayCatalog, productionCatalog);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.differences ? 1 : 0;
  } finally { await Promise.all(clients.map((client) => client.end().catch(() => {}))); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(`Diff baseline gagal: ${error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[redacted database URL]')}`); process.exitCode = 1; });
}
