import { describe, expect, it } from "vitest";
import { staffCanDeleteBoard } from "@/features/tasks/board-permissions";

/**
 * `deleteBoardAction` dulu menyatukan otorisasi dengan filter `delete`:
 *
 *   ```ts
 *   await db.from("task_boards").delete().eq("id", boardId).eq("owner_id", user.id);
 *   ```
 *
 * Itu kegagalan senyap kelas M-2. `delete` yang tidak mengenai satu baris pun
 * mengembalikan `error: null`, jadi **tiga keadaan berbeda** dilaporkan sebagai
 * satu sukses: board terhapus, board tidak ada, dan board milik staf lain.
 *
 * Yang membuatnya benar-benar terlihat di UI: `getMentorBoards`
 * (`features/tasks/queries.ts:25-54`) mengembalikan SELURUH board tanpa filter
 * pemilik — daftar board memang global by design. Jadi halaman merender tombol
 * sampah di board milik staf lain, dan menekannya tidak melakukan apa pun tanpa
 * pesan apa pun.
 *
 * Aturannya sekarang hidup di satu fungsi sinkron yang dipakai **dua kali**: oleh
 * aksi (untuk menolak) dan oleh halaman (untuk tidak merender tombolnya). Itulah
 * yang membuat fungsi ini sepadan diuji — ia satu-satunya tempat di mana kedua
 * keputusan itu bisa berbeda pendapat.
 *
 * Setiap kasus memakai **asersi ganda**: bentuk lamanya direkonstruksi dan
 * dibuktikan salah, lalu bentuk sekarang dibuktikan benar.
 */

/**
 * Rekonstruksi persis keputusan lamanya: `.eq("owner_id", user.id)` di dalam
 * `delete`. Mengembalikan "berapa baris yang terkena" — karena nol baris itulah
 * bentuk kegagalannya, bukan sebuah error.
 */
function barisTerkenaBentukLama(userId: string, ownerId: string | null): number {
  return ownerId === userId ? 1 : 0;
}

describe("super_admin boleh menghapus board siapa pun", () => {
  it("bentuk lama menghapus nol baris dan melaporkan sukses", () => {
    // Bentuk lamanya tidak pernah melihat role sama sekali.
    expect(barisTerkenaBentukLama("sa-1", "staf-lain")).toBe(0);

    expect(staffCanDeleteBoard(["super_admin"], "sa-1", "staf-lain")).toBe(true);
  });

  it("berlaku juga saat role lain ikut menempel", () => {
    expect(staffCanDeleteBoard(["admin", "super_admin"], "sa-1", "staf-lain")).toBe(true);
  });
});

describe("admin hanya boleh menghapus board miliknya", () => {
  it("board milik sendiri: keduanya sepakat", () => {
    expect(barisTerkenaBentukLama("admin-1", "admin-1")).toBe(1);
    expect(staffCanDeleteBoard(["admin"], "admin-1", "admin-1")).toBe(true);
  });

  it("board milik staf lain: bentuk lama senyap, bentuk sekarang menolak", () => {
    expect(barisTerkenaBentukLama("admin-1", "admin-2")).toBe(0);

    // Penolakan eksplisit — inilah yang berubah dari "tidak terjadi apa-apa".
    expect(staffCanDeleteBoard(["admin"], "admin-1", "admin-2")).toBe(false);
  });
});

describe("board yatim (owner_id null) tetap bisa dihapus", () => {
  /**
   * `task_boards.owner_id` adalah `on delete set null` (`0001_initial_schema.sql`),
   * jadi board yang pemiliknya dihapus menjadi yatim.
   *
   * Ini cabang yang paling mudah terlewat, dan konsekuensinya permanen: tanpa
   * cabang ini board yatim mustahil dihapus siapa pun — termasuk pembuatnya, yang
   * sudah tidak ada. Papan itu menetap di daftar global setiap staf selamanya.
   */
  it("bentuk lama tidak pernah bisa mengenainya", () => {
    // `null === user.id` selalu false, untuk user ID apa pun.
    expect(barisTerkenaBentukLama("admin-1", null)).toBe(0);
    expect(barisTerkenaBentukLama("sa-1", null)).toBe(0);
  });

  it("admin biasa boleh menghapus board yatim", () => {
    expect(staffCanDeleteBoard(["admin"], "admin-1", null)).toBe(true);
  });

  it("super_admin juga, lewat cabangnya sendiri", () => {
    expect(staffCanDeleteBoard(["super_admin"], "sa-1", null)).toBe(true);
  });
});

describe("role di luar staf tidak mendapat jalan masuk lewat fungsi ini", () => {
  /**
   * Guard `requireStaff` di aksinya sudah menyaring role, jadi ini bukan lapis
   * pertahanan satu-satunya. Diuji tetap karena fungsi ini **juga** dipakai
   * halaman untuk memutuskan render, dan halaman memanggilnya dengan apa pun yang
   * `getUserRoleCodes` kembalikan.
   */
  it("intern tidak bisa menghapus board milik orang lain", () => {
    expect(staffCanDeleteBoard(["intern"], "intern-1", "admin-1")).toBe(false);
  });

  it("daftar role kosong tidak pernah memberi hak lintas-pemilik", () => {
    expect(staffCanDeleteBoard([], "siapa-pun", "admin-1")).toBe(false);
  });

  it("tapi kepemilikan tetap dihormati tanpa role apa pun", () => {
    // Konsisten dengan bentuk lamanya, dan itu memang yang diinginkan: aturan ini
    // soal kepemilikan, bukan soal peran.
    expect(staffCanDeleteBoard([], "u-1", "u-1")).toBe(true);
  });
});

describe("fungsinya murni — aman dipanggil sekali per baris saat render", () => {
  it("tidak bergantung pada urutan daftar role", () => {
    const a = staffCanDeleteBoard(["intern", "admin", "super_admin"], "u", "lain");
    const b = staffCanDeleteBoard(["super_admin", "admin", "intern"], "u", "lain");
    expect(a).toBe(b);
  });

  it("pemanggilan berulang memberi jawaban sama", () => {
    // Inilah premis yang membuat halaman boleh memanggilnya di dalam `.map()`
    // tanpa menambah satu pun kueri per board.
    const args = [["admin"], "u-1", "u-2"] as const;
    expect(staffCanDeleteBoard(...args)).toBe(staffCanDeleteBoard(...args));
  });
});
