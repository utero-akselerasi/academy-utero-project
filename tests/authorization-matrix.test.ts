import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";

/**
 * Matriks otorisasi: setiap permukaan yang bisa dijangkau dari internet harus
 * punya guard, dan guard-nya harus yang benar untuk area itu.
 *
 * Kenapa statis, bukan memanggil setiap halaman dengan sesi tiruan: cacat yang
 * benar-benar terjadi di repo ini bukan guard yang salah menghitung peran — tapi
 * **guard yang tidak ada**. Halaman baru yang lupa dipagari tidak akan pernah
 * gagal di test yang hanya menguji halaman yang sudah kita tahu ada. Test ini
 * menemukan berkasnya sendiri dari disk, jadi `page.tsx` baru otomatis masuk
 * cakupan tanpa siapa pun perlu mendaftarkannya.
 *
 * Batas kejujuran yang harus dinyatakan terang: ini memeriksa **bahwa** guard
 * dipanggil, bukan bahwa panggilannya benar secara logika, dan sama sekali tidak
 * menyentuh RLS, grant, atau policy di database. Lubang Batch 0 tidak akan
 * tertangkap di sini — lubang itu ada di lapisan yang tak dilewati kode ini.
 */

const ROOT = join(import.meta.dirname, "..");

/** Jalur relatif ber-slash-depan, supaya pesan gagalnya sama di Windows & CI. */
const toPosix = (abs: string) => relative(ROOT, abs).split(sep).join(posix.sep);

function walk(dir: string, match: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full, match));
    } else if (match(entry)) {
      out.push(full);
    }
  }
  return out;
}

const read = (abs: string) => readFileSync(abs, "utf8");

/**
 * Nama guard yang dipanggil di sebuah berkas, **termasuk lewat alias**.
 *
 * Aliasnya bukan kasus teoretis: `features/admin/actions.ts` menulis
 * `const requireStaff = requireAdmin` dan `features/assessments/actions.ts`
 * menulis `const requireAdminUser = requireAdmin`. Pencarian yang hanya mencari
 * nama guard aslinya akan melaporkan kedua berkas itu tanpa guard — dan laporan
 * palsu yang muncul di hari pertama adalah cara tercepat membuat test ini
 * dimatikan orang.
 */
function guardsUsedIn(source: string): Set<string> {
  const canonical = [
    "requireUser",
    "requireRole",
    "requireAdmin",
    "requireSuperAdmin",
    "requireIntern",
    "requireSchool",
    "requireRouteUser",
    "requireRouteRole",
    "requireRouteAdmin",
    "requireRouteSuperAdmin",
  ];

  // Peta alias → guard asli, dibaca dari `const X = requireY` di berkas ini.
  const aliases = new Map<string, string>();
  for (const m of source.matchAll(/const\s+(\w+)\s*=\s*(require\w+)\s*;/g)) {
    if (canonical.includes(m[2])) aliases.set(m[1], m[2]);
  }

  const found = new Set<string>();
  for (const m of source.matchAll(/\b(\w+)\s*\(/g)) {
    const name = m[1];
    if (canonical.includes(name)) found.add(name);
    else if (aliases.has(name)) found.add(aliases.get(name)!);
  }
  return found;
}

/**
 * Peran yang diterima tiap guard. Inilah yang diperiksa, BUKAN nama guard-nya.
 *
 * Pilihan ini diambil setelah versi pertama test ini salah menuduh: halaman di
 * bawah `app/dashboard/super-admin/` yang mengandalkan layout induk dilaporkan
 * gagal karena layout memanggil `requireRole(["super_admin"])` alih-alih
 * `requireSuperAdmin()` — padahal keduanya mengizinkan peran yang **sama persis**.
 * Menuntut nama tertentu menguji gaya penulisan; menuntut himpunan peran menguji
 * siapa yang sebenarnya bisa masuk.
 *
 * `ANY` berarti "peran apa pun yang sudah login" (`requireUser`). Ia sengaja
 * dibedakan dari himpunan peran: halaman yang hanya menuntut sesi tidak boleh
 * diam-diam lulus di area yang menuntut peran tertentu.
 */
const ANY = "__any_authenticated__";

const GUARD_ROLES: Record<string, string[]> = {
  requireSuperAdmin: ["super_admin"],
  requireRouteSuperAdmin: ["super_admin"],
  requireAdmin: ["admin", "super_admin"],
  requireRouteAdmin: ["admin", "super_admin"],
  requireIntern: ["intern", "super_admin"],
  requireSchool: ["school", "super_admin"],
  requireUser: [ANY],
  requireRouteUser: [ANY],
};

/**
 * Peran yang benar-benar bisa masuk ke sebuah halaman: dari guard-nya sendiri
 * ATAU dari `layout.tsx` mana pun di atasnya.
 *
 * Enam halaman di repo ini memang tidak memanggil guard sendiri
 * (`app/dashboard/admin/page.tsx`, `.../mentor/page.tsx`, dan lainnya) — mereka
 * dilindungi `ProtectedDashboardLayout` di layout induknya. Test yang tidak
 * menaiki pohon akan menuduh keenamnya bolong.
 */
function effectiveAccess(pageAbs: string): { roles: Set<string>; from: string } {
  const rolesFrom = (src: string): Set<string> | null => {
    const out = new Set<string>();
    for (const g of guardsUsedIn(src)) {
      if (g in GUARD_ROLES) GUARD_ROLES[g].forEach(r => out.add(r));
    }
    // `requireRole([...])` / `requireRouteRole([...])` membawa daftarnya sendiri.
    for (const m of src.matchAll(/require(?:Route)?Role\s*\(\s*\[([^\]]*)\]/g)) {
      [...m[1].matchAll(/"(\w+)"/g)].forEach(r => out.add(r[1]));
    }
    return out.size > 0 ? out : null;
  };

  const own = rolesFrom(read(pageAbs));

  // Layout terdekat di atas halaman ini yang memagari.
  let layoutRoles: Set<string> | null = null;
  let layoutFrom = "";
  let dir = join(pageAbs, "..");
  const appDir = join(ROOT, "app");
  while (dir.startsWith(appDir) && !layoutRoles) {
    const layout = join(dir, "layout.tsx");
    try {
      const src = read(layout);
      // `ProtectedDashboardLayout` menerima `allowedRoles` dan memanggil
      // `requireRole` di dalamnya, jadi kehadirannya di layout ADALAH guard.
      const m = src.match(/allowedRoles=\{\[([^\]]*)\]\}/);
      if (m && src.includes("ProtectedDashboardLayout")) {
        const codes = [...m[1].matchAll(/"(\w+)"/g)].map(x => x[1]);
        if (codes.length > 0) { layoutRoles = new Set(codes); layoutFrom = toPosix(layout); }
      }
      if (!layoutRoles) {
        const direct = rolesFrom(src);
        if (direct) { layoutRoles = direct; layoutFrom = toPosix(layout); }
      }
    } catch {
      // Tak ada layout di tingkat ini; lanjut ke atas.
    }
    dir = join(dir, "..");
  }

  /**
   * Keduanya berlaku, jadi yang sebenarnya bisa masuk adalah **irisannya** —
   * bukan guard halaman saja.
   *
   * Versi pertama test ini mengembalikan guard halaman begitu ada, dan itu salah
   * menuduh dua halaman: `intern/certificate/print/page.tsx` dan
   * `school/reports/page.tsx` memanggil `requireUser()` (hanya menuntut sesi),
   * tapi keduanya berada di bawah layout yang sudah membatasi perannya. Guard
   * halaman di situ MEMPERKETAT (menuntut sesi di atas peran), tidak memperluas.
   * Melaporkannya sebagai kebocoran adalah kesalahan arah: tak ada peran tambahan
   * yang bisa masuk.
   *
   * `ANY` dibuang dari irisan kalau layout sudah menyebut peran — "peran apa pun
   * yang login" yang dibatasi ke `["school","super_admin"]` ya berarti kedua
   * peran itu.
   */
  if (own && layoutRoles) {
    const merged = new Set(layoutRoles);
    for (const r of own) if (r !== ANY && !layoutRoles.has(r)) merged.add(r);
    return { roles: merged, from: `${toPosix(pageAbs)} + ${layoutFrom}` };
  }
  if (own) return { roles: own, from: toPosix(pageAbs) };
  if (layoutRoles) return { roles: layoutRoles, from: layoutFrom };
  return { roles: new Set(), from: "(tidak ada)" };
}

// ---------------------------------------------------------------------------
// Allowlist publik — dipisah dari logika, dan setiap barisnya wajib beralasan.
//
// Sebuah allowlist tanpa alasan pada akhirnya menjadi tempat membuang halaman
// yang gagal. Jadi bentuknya `path → alasan`, dan alasan itulah yang dibaca
// orang saat menimbang apakah entri barunya sah.
// ---------------------------------------------------------------------------
const PUBLIC_PAGES: Record<string, string> = {
  "app/dashboard/forbidden/page.tsx":
    "Halaman 403 itu sendiri. Memagarinya akan membuat pengguna yang ditolak diarahkan ke halaman yang juga menolaknya — lingkaran.",
};

const PUBLIC_ROUTES: Record<string, string> = {
  "app/api/health/route.ts":
    "Health check untuk container/monitor. Tidak menyentuh data domain.",
  "app/api/articles/route.ts":
    "Proksi artikel publik (cms.carubra.com). Isinya memang ditayangkan ke pengunjung anonim di /blog.",
  "app/api/articles/[slug]/route.ts":
    "Sama seperti di atas, satu artikel.",
};

// ---------------------------------------------------------------------------
// Peran yang BOLEH masuk tiap area. Kunci = awalan jalur, diuji dari yang
// terpanjang, jadi `/dashboard/super-admin` menang atas `/dashboard`.
//
// Bentuknya batas atas: peran yang muncul di sebuah halaman tapi tidak ada di
// `maxRoles` areanya adalah kebocoran. Ini menangkap arah yang benar-benar
// berbahaya — `requireAdmin` yang menyelip di area super-admin — sementara guard
// yang lebih ketat dari yang diminta tetap lulus.
// ---------------------------------------------------------------------------
const EXPECTED_PAGE_ACCESS: { prefix: string; maxRoles: string[]; why: string }[] = [
  {
    prefix: "app/dashboard/super-admin",
    maxRoles: ["super_admin"],
    why: "Hanya super_admin. `admin` di sini membuka manajemen user & audit log untuk admin biasa.",
  },
  {
    prefix: "app/dashboard/admin",
    maxRoles: ["admin", "super_admin"],
    why: "admin + super_admin.",
  },
  {
    // `/dashboard/mentor/*` adalah area kerja `admin` — `mentor` bukan lagi
    // peran login (migrasi 0028). Bukan salah tulis.
    prefix: "app/dashboard/mentor",
    maxRoles: ["admin", "super_admin"],
    why: "Area kerja pembimbing, dijaga sebagai admin. Peran `mentor` sudah tidak ada.",
  },
  {
    prefix: "app/dashboard/intern",
    maxRoles: ["intern", "super_admin"],
    why: "Peserta, super_admin untuk dukungan.",
  },
  {
    prefix: "app/dashboard/school",
    maxRoles: ["school", "super_admin"],
    why: "Kontak sekolah, super_admin untuk dukungan.",
  },
  {
    prefix: "app/dashboard/profile",
    maxRoles: [ANY, "super_admin", "admin", "school", "intern"],
    why: "Profil sendiri; peran apa pun yang sudah login boleh.",
  },
];

// ---------------------------------------------------------------------------

describe("halaman dashboard", () => {
  const pages = walk(join(ROOT, "app", "dashboard"), n => n === "page.tsx").map(toPosix);

  it("menemukan halaman untuk diperiksa", () => {
    // Tanpa asersi ini, `walk()` yang salah jalur akan membuat seluruh blok di
    // bawahnya lulus dengan nol kasus — test hijau yang tidak menguji apa pun.
    expect(pages.length).toBeGreaterThan(30);
  });

  it.each(pages)("%s dijaga", page => {
    if (page in PUBLIC_PAGES) return;
    const { roles } = effectiveAccess(join(ROOT, page));
    expect(
      roles.size,
      `${page} tidak punya guard, sendiri maupun lewat layout di atasnya. ` +
        `Tambahkan salah satu require* di berkasnya, atau daftarkan di PUBLIC_PAGES dengan alasannya.`,
    ).toBeGreaterThan(0);
  });

  it.each(pages)("%s tidak mengizinkan peran di luar areanya", page => {
    if (page in PUBLIC_PAGES) return;
    const rule = EXPECTED_PAGE_ACCESS.filter(r => page.startsWith(r.prefix)).sort(
      (a, b) => b.prefix.length - a.prefix.length,
    )[0];
    if (!rule) return; // Area di luar daftar; asersi "dijaga" di atas tetap berlaku.

    const { roles, from } = effectiveAccess(join(ROOT, page));
    const extra = [...roles].filter(r => !rule.maxRoles.includes(r));
    expect(
      extra,
      `${page} mengizinkan [${[...roles].join(", ")}] (dari ${from}), ` +
        `tapi area ${rule.prefix} hanya boleh [${rule.maxRoles.join(", ")}]. ` +
        `Kelebihannya: [${extra.join(", ")}]. ${rule.why}`,
    ).toEqual([]);
  });
});

describe("route handler", () => {
  const routes = walk(join(ROOT, "app"), n => n === "route.ts").map(toPosix);

  it("menemukan route untuk diperiksa", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it.each(routes)("%s dijaga", route => {
    if (route in PUBLIC_ROUTES) return;
    const guards = guardsUsedIn(read(join(ROOT, route)));
    expect(
      guards.size,
      `${route} tidak memanggil guard apa pun. Route handler TIDAK terlindungi layout — ` +
        `ia dijangkau langsung lewat URL-nya, jadi guard harus ada di berkasnya sendiri.`,
    ).toBeGreaterThan(0);
  });

  it.each(routes)("%s memakai guard varian Route*", route => {
    if (route in PUBLIC_ROUTES) return;
    const guards = [...guardsUsedIn(read(join(ROOT, route)))];
    const routeVariants = guards.filter(g => g.startsWith("requireRoute"));
    expect(
      routeVariants.length,
      `${route} memakai [${guards.join(", ")}]. Route handler harus memakai varian ` +
        `require*Route* yang MELEMPAR RouteAuthorizationError, bukan varian halaman yang memanggil ` +
        `redirect() — redirect di dalam route handler menghasilkan respons 3xx ke klien API, ` +
        `bukan 401/403, sehingga penolakannya tidak terbaca sebagai penolakan.`,
    ).toBeGreaterThan(0);
  });
});

describe("server action", () => {
  const actionFiles = walk(join(ROOT, "features"), n => n.endsWith(".ts"))
    .filter(f => read(f).includes('"use server"'))
    .map(toPosix);

  it("menemukan berkas action untuk diperiksa", () => {
    expect(actionFiles.length).toBeGreaterThan(5);
  });

  /**
   * Action yang sengaja tanpa guard, dengan alasannya. Keduanya dipanggil dari
   * jalur yang belum punya sesi.
   */
  const UNGUARDED_ACTIONS: Record<string, string> = {
    "features/auth/actions.ts":
      "Login & logout. Login justru yang MEMBUAT sesi, jadi tak mungkin menuntut sesi.",
    "features/registration/actions.ts":
      "Formulir pendaftaran magang publik — pelamar belum punya akun. Satu-satunya grant tulis anon yang disengaja (lihat 0029).",
    "features/lms/certificate-helper.ts":
      "Helper internal, dipanggil dari action lain yang sudah memagari pemanggilnya.",
  };

  it.each(actionFiles)("%s memanggil guard", file => {
    if (file in UNGUARDED_ACTIONS) return;
    const guards = guardsUsedIn(read(join(ROOT, file)));
    expect(
      guards.size,
      `${file} bertanda "use server" tapi tidak memanggil guard apa pun. Setiap fungsi ` +
        `yang diekspor dari berkas "use server" adalah endpoint HTTP yang bisa dipanggil ` +
        `siapa pun yang tahu id-nya — bukan hanya lewat tombol di UI.`,
    ).toBeGreaterThan(0);
  });

  /**
   * Setiap fungsi yang diekspor diperiksa satu per satu, bukan hanya berkasnya.
   *
   * Ini yang membedakan test ini dari `grep`: berkas dengan 35 export dan 12
   * panggilan guard akan lulus pemeriksaan tingkat-berkas di atas, padahal 23
   * fungsi sisanya bisa saja terbuka. Yang dihitung adalah badan tiap fungsi.
   */
  const perFunction: { file: string; fn: string; guarded: boolean }[] = [];

  for (const file of actionFiles) {
    if (file in UNGUARDED_ACTIONS) continue;
    const src = read(join(ROOT, file));
    const aliasNames = [...src.matchAll(/const\s+(\w+)\s*=\s*(require\w+)\s*;/g)].map(m => m[1]);
    const guardPattern = new RegExp(`\\b(require\\w+|${aliasNames.join("|") || "\\0"})\\s*\\(`);

    // Potong per `export async function` / `export function`; batas fungsi
    // diambil sampai export berikutnya. Kasar, tapi cukup: yang dicari adalah
    // ADA-TIDAKNYA panggilan guard di dalam badan, bukan struktur sintaksisnya.
    const marks = [...src.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)];
    for (let i = 0; i < marks.length; i++) {
      const start = marks[i].index!;
      const end = i + 1 < marks.length ? marks[i + 1].index! : src.length;
      const body = src.slice(start, end);
      perFunction.push({ file, fn: marks[i][1], guarded: guardPattern.test(body) });
    }
  }

  it("menemukan fungsi action untuk diperiksa", () => {
    expect(perFunction.length).toBeGreaterThan(50);
  });

  /**
   * Fungsi yang guard-nya ada di pemanggilnya, bukan di badannya sendiri.
   *
   * Daftar ini DIISI dari hasil pertama kali test ini dijalankan, dan setiap
   * entri harus dibaca manual dulu. Entri yang ditambahkan tanpa dibaca adalah
   * cara test ini berhenti berguna.
   */
  const GUARDED_BY_CALLER: Record<string, string> = {};

  it.each(perFunction.map(p => [`${p.file}::${p.fn}`, p] as const))(
    "%s memanggil guard di badannya",
    (key, p) => {
      if (key in GUARDED_BY_CALLER) return;
      expect(
        p.guarded,
        `${p.fn} di ${p.file} tidak memanggil guard. Action ini adalah endpoint ` +
          `HTTP tersendiri; guard di action lain di berkas yang sama tidak melindunginya.`,
      ).toBe(true);
    },
  );
});
