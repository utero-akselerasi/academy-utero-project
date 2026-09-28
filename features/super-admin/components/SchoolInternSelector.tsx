"use client";

import { useId, useRef, useState, useEffect } from "react";
import { Search } from "lucide-react";

type Intern = {
  id: string;
  full_name: string;
  email: string | null;
  major: string | null;
  status: string;
  school_id: string | null;
};

type Props = {
  interns: Intern[];
  currentSchoolId: string;
  placeholder?: string;
};

/**
 * Pemilih siswa dengan pencarian, dalam bentuk **combobox** sesuai APG.
 *
 * Sebelumnya komponen ini adalah popup hasil pencarian tanpa satu pun semantik
 * (temuan #4): input-nya input biasa, daftar hasilnya tumpukan `<button>`, dan
 * tidak ada apa pun yang memberi tahu pembaca layar bahwa mengetik di input itu
 * memunculkan daftar pilihan di bawahnya. Konsekuensinya berlapis:
 *
 * - Pembaca layar tidak mengumumkan bahwa popup terbuka, berapa hasilnya,
 *   maupun pilihan mana yang aktif. Yang terdengar hanya "edit text".
 * - Panah atas/bawah tidak melakukan apa pun. Untuk mencapai hasil pencarian,
 *   pengguna keyboard harus Tab melewati setiap hasil satu per satu — dan
 *   karena hasilnya `<button>`, Tab **keluar dari input**, yang membuat daftar
 *   yang sedang dibaca ikut berubah begitu pengguna mengetik lagi.
 * - Escape tidak menutup popup, jadi satu-satunya cara menutupnya adalah
 *   mengklik di luar: butuh tetikus.
 *
 * Bentuk APG-nya: input `role="combobox"` memegang fokus **sepanjang waktu**,
 * dan opsi yang aktif ditunjuk lewat `aria-activedescendant` alih-alih benar-benar
 * difokus. Itu sebabnya opsinya `div role="option"`, bukan `<button>` — opsi
 * yang bisa difokus akan menarik fokus keluar dari input dan merusak pengetikan.
 */
export function SchoolInternSelector({ interns, currentSchoolId, placeholder = "Cari nama siswa..." }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  /**
   * Indeks opsi aktif; `-1` berarti belum ada yang aktif.
   *
   * Disimpan mentah lalu dijepit saat dibaca (lihat `activeIndex` di bawah),
   * bukan diperbaiki lewat effect. Menyetel state di dalam effect memicu render
   * berjenjang, dan jepitan saat baca memberi hasil yang sama tanpa render
   * tambahan.
   */
  const [rawActiveIndex, setRawActiveIndex] = useState(-1);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  // Komponen ini dirender sekali per instansi di halaman yang sama, jadi id
  // yang di-hardcode akan berulang — dan `aria-controls`/`htmlFor` yang
  // menunjuk ke id kembar akan menyambung ke elemen instansi lain.
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const filtered = interns.filter((intern) =>
    intern.full_name.toLowerCase().includes(query.toLowerCase()) ||
    (intern.email || "").toLowerCase().includes(query.toLowerCase()) ||
    (intern.major || "").toLowerCase().includes(query.toLowerCase())
  );

  const activeIndex = rawActiveIndex >= filtered.length ? -1 : rawActiveIndex;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Opsi aktif digulirkan ke dalam pandangan. Dengan `aria-activedescendant`,
  // opsi aktif TIDAK difokus, jadi peramban tidak menggulirkannya sendiri —
  // tanpa langkah ini panah bawah bisa menjalankan aktif ke opsi yang berada di
  // luar area daftar yang terlihat.
  useEffect(() => {
    if (activeIndex < 0) return;
    const el = listboxRef.current?.querySelector<HTMLElement>(`#${CSS.escape(`${baseId}-option-${activeIndex}`)}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, baseId]);

  const selectedIntern = interns.find((intern) => intern.id === selectedId);

  function selectIntern(intern: Intern) {
    setSelectedId(intern.id);
    setQuery(intern.full_name);
    setIsOpen(false);
    setRawActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      // `preventDefault` supaya kursor teks tidak melompat ke ujung nilai input
      // — panah di combobox milik daftarnya, bukan milik kolom teks.
      event.preventDefault();

      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (filtered.length === 0) return;

      const step = event.key === "ArrowDown" ? 1 : -1;
      // Melingkar, dan `+ filtered.length` supaya modulo dari -1 tidak negatif.
      const next = (activeIndex + step + filtered.length) % filtered.length;
      setRawActiveIndex(activeIndex < 0 && step === -1 ? filtered.length - 1 : next);
      return;
    }

    if (event.key === "Home" && isOpen && filtered.length > 0) {
      event.preventDefault();
      setRawActiveIndex(0);
      return;
    }

    if (event.key === "End" && isOpen && filtered.length > 0) {
      event.preventDefault();
      setRawActiveIndex(filtered.length - 1);
      return;
    }

    if (event.key === "Enter") {
      // Hanya menelan Enter kalau memang ada opsi aktif untuk dipilih.
      // Menelannya tanpa syarat akan memblokir pengiriman form dari dalam
      // input, padahal form ini punya tombol submit sendiri.
      if (isOpen && activeIndex >= 0) {
        event.preventDefault();
        selectIntern(filtered[activeIndex]);
      }
      return;
    }

    if (event.key === "Escape") {
      if (isOpen) {
        // `stopPropagation` supaya Escape tidak menembus ke dialog atau
        // handler lain di halaman: yang ditutup pengguna adalah daftar ini.
        event.stopPropagation();
        setIsOpen(false);
        setRawActiveIndex(-1);
      }
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input type="hidden" name="internId" value={selectedId} required />

      {/* Desainnya tanpa label terlihat — namanya hanya `placeholder`, yang
          hilang begitu pengguna mengetik — jadi labelnya `sr-only`, tetap
          terhubung lewat `htmlFor`/`id`. */}
      <label className="sr-only" htmlFor={inputId}>
        Cari dan pilih siswa untuk dihubungkan
      </label>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={16}
          aria-hidden="true"
        />
        <input
          type="text"
          id={inputId}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          // `aria-activedescendant` kosong, bukan `undefined`, saat tak ada opsi
          // aktif: atributnya tetap ada supaya pembaca layar tahu combobox ini
          // memang memakai pola activedescendant.
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : ""}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            // Kueri baru berarti daftar baru: opsi aktif yang lama tidak lagi
            // merujuk ke siswa yang sama.
            setRawActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-xs outline-none focus:border-teal-500"
        />
      </div>

      {/* Jumlah hasil diumumkan lewat live region. Daftar yang berubah saat
          pengguna mengetik tidak terdengar sama sekali tanpa ini — pengguna
          pembaca layar tidak punya cara tahu pencariannya menyempit atau
          kosong. `role="status"` (bukan `alert`) supaya tidak memotong
          pengumuman ketikan. */}
      <p className="sr-only" role="status">
        {isOpen
          ? filtered.length === 0
            ? "Tidak ada siswa ditemukan."
            : `${filtered.length} siswa ditemukan.`
          : ""}
      </p>

      {selectedIntern && !isOpen && (
        <div className="mt-2 rounded-lg border border-teal-200 bg-teal-50 p-2 text-xs">
          <p className="font-bold text-teal-900">{selectedIntern.full_name}</p>
          <p className="text-teal-700">{selectedIntern.email || "-"}</p>
          <button
            type="button"
            onClick={() => {
              setSelectedId("");
              setQuery("");
              setIsOpen(true);
            }}
            className="mt-1 text-xs font-bold text-teal-800 hover:text-teal-900"
            aria-label={`Ubah pilihan siswa, sekarang ${selectedIntern.full_name}`}
          >
            Ubah pilihan
          </button>
        </div>
      )}

      {/* Listbox selalu ada di DOM saat terbuka, termasuk saat kosong: elemen
          yang ditunjuk `aria-controls` harus benar-benar ada. */}
      {isOpen && (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label="Hasil pencarian siswa"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {filtered.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-500">Tidak ada siswa ditemukan.</div>
          ) : (
            filtered.map((intern, index) => (
              <div
                key={intern.id}
                id={optionId(index)}
                role="option"
                aria-selected={intern.id === selectedId}
                // `onMouseDown`, bukan `onClick`: handler klik-di-luar di atas
                // berjalan pada `mousedown`, dan menutup daftar di sana akan
                // melepas elemen ini sebelum `click` sempat terpicu.
                onMouseDown={() => selectIntern(intern)}
                onMouseEnter={() => setRawActiveIndex(index)}
                className={`block w-full cursor-pointer border-b border-slate-100 px-3 py-2 text-left text-xs ${
                  index === activeIndex ? "bg-slate-100" : "hover:bg-slate-50"
                }`}
              >
                <p className="font-bold text-slate-900">{intern.full_name}</p>
                <p className="text-slate-600">{intern.email || "-"}</p>
                <p className="text-slate-500">
                  {intern.major || "Jurusan belum diisi"} · {intern.status}
                  {intern.school_id === currentSchoolId && <span className="ml-2 text-teal-700">(sudah di sini)</span>}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
