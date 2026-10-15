# Script deployment dan gate

Folder ini berisi orkestrasi level aplikasi: validasi environment, smoke test, evidence UAT, dan gate deployment.

Script PostgreSQL backend, storage internal, backup, restore, bootstrap, dan migrasi identitas berada di `backend/scripts/`.

Perintah strategi aktif tersedia di `package.json`: `validate:selfhosted-production-env`, `preflight:selfhosted-production`, `smoke:selfhosted-smtp`, dan `verify:selfhosted-uat`.

Script bernama `phase13`, `supabase`, atau full cutover dipertahankan untuk audit historis. Script tersebut bukan instruksi copy data production saat ini. Scope aktif ada di `docs/35-selfhosted-identity-only.md`.
