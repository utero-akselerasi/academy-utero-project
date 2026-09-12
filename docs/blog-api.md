# Integrasi blog dengan CMS Artikel

Acuan: API.md revisi 12 September 2026 dan API-DEPLOYMENT.md dari project cms-artikel.

Konfigurasi server:

```env
ARTIKEL_API_URL=https://cms.carubra.com
ARTIKEL_API_KEY=
ARTIKEL_DEFAULT_CATEGORY=global,news,carubra,academy
```

Isi key read milik website tujuan melalui secret deployment. Jangan simpan key di Git atau browser.
Nama lama ARTIKEL_PUBLIC_READ_API_URL dan ARTIKEL_PUBLIC_READ_API_KEY tetap didukung; nama baru diprioritaskan.
URL origin maupun URL berakhiran /api/v1 diterima. Setelah rotasi key CMS, perbarui secret konsumen lalu restart/redeploy aplikasi.

- ARTIKEL_DEFAULT_CATEGORY menerima satu atau beberapa slug dipisahkan koma. Setiap kategori diambil terpisah karena upstream menerima satu slug per request; hasil digabung, diduplikasi berdasarkan slug, diurutkan berdasarkan tanggal publikasi, lalu dipaginasi.
- /blog?category=news&page=2 membaca artikel published, 10 per halaman.
- /api/articles?category=news&page=2&limit=10 meneruskan query dan mengembalikan data serta meta.
- /blog/[slug] dan /api/articles/[slug] membaca detail; upstream 404 menjadi 404 lokal.
- Request read memakai header x-artikel-key dan cache Next.js 60 detik. Signed URL tidak disimpan permanen.
- Add-on mengikuti placement dan sort_order; gallery mendukung gallery_items maupun config.media.
- Tanpa key read, halaman blog mempertahankan fallback database lokal. Proxy tetap memerlukan key.
- Automation API dan endpoint internal CMS tidak diubah oleh pembaruan blog ini.

Validasi lokal: npm run typecheck dan npm run build. Uji koneksi production memerlukan key read valid dan kategori yang tersedia pada tenant tujuan.
