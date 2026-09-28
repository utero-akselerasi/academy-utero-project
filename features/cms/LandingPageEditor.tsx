"use client";

import { useEffect, useRef, useState } from "react";
import { updateLandingPageSettingsAction, uploadCmsFileAction } from "@/features/cms/actions";
import { type LandingPageSettings } from "./types";
import {
  Save, Upload, ArrowUp, ArrowDown, Plus, Trash2
} from "lucide-react";

type Props = {
  landingSettings?: LandingPageSettings;
};

type TabValue = "hero" | "skills" | "experts" | "partners" | "pages";

/**
 * Sub-tab sebagai data, bukan JSX yang ditulis satu per satu.
 *
 * Pola `role="tablist"` APG mewajibkan **roving tabindex**: tepat satu tab yang
 * punya `tabIndex={0}`. Nilainya juga dipakai menyusun id tab dan id panel yang
 * saling menunjuk lewat `aria-controls`/`aria-labelledby`. Ketiganya harus
 * konsisten, jadi sumbernya satu.
 */
const TABS: { label: string; value: TabValue }[] = [
  { label: "Hero Banner", value: "hero" },
  { label: "Skills Competencies", value: "skills" },
  { label: "Top Expertisers", value: "experts" },
  { label: "Partnership Logos", value: "partners" },
  { label: "About, Kontak, & Syarat", value: "pages" }
];

const tabId = (value: TabValue) => `landing-tab-${value}`;
const panelId = (value: TabValue) => `landing-panel-${value}`;

/**
 * Nama baris untuk tombol pindah/hapus.
 *
 * Tombol hapus di daftar berulang wajib menyebut **apa** yang dihapusnya:
 * "Hapus" saja diumumkan sepuluh kali persis sama, dan pengguna pembaca layar
 * tidak punya cara tahu mana yang akan hilang. Isi field dipakai kalau ada
 * (itu yang dikenali pengguna), nomor baris kalau masih kosong.
 */
const rowName = (value: string | undefined, index: number) =>
  value && value.trim() ? value.trim() : `baris ${index + 1}`;

/** Cincin fokus untuk label pembungkus input file ber-`sr-only`. */
const uploadLabelFocus =
  "focus-within:outline-2 focus-within:outline-teal-500 focus-within:outline-offset-2";

export function LandingPageEditor({ landingSettings }: Props) {
  const [landingSubTab, setLandingSubTab] = useState<TabValue>("hero");
  const tablistRef = useRef<HTMLDivElement>(null);
  const [skillsList, setSkillsList] = useState<any[]>(landingSettings?.skills || []);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [expertsList, setExpertsList] = useState<any[]>(landingSettings?.expertisers || []);
  // Dua state, bukan satu: `heroImagePath` yang dikirim balik ke server lewat
  // input tersembunyi, dan `heroImagePreviewUrl` yang dirender di <img>.
  //
  // Menggabungkannya adalah jebakannya: nilai tersimpan dimuat ke state lalu
  // dikirim balik apa adanya saat Simpan. Kalau state itu berisi URL hasil
  // resolusi, setiap penyimpanan menulis URL penuh kembali ke DB dan membatalkan
  // konversi ke object path.
  const [heroImagePath, setHeroImagePath] = useState<string>(landingSettings?.hero_image_path || "");
  const [heroImagePreviewUrl, setHeroImagePreviewUrl] = useState<string>(landingSettings?.hero_image_url || "");
  const [partnershipsList, setPartnershipsList] = useState<any[]>(landingSettings?.partnerships || []);
  const [uploadingPartnerIndex, setUploadingPartnerIndex] = useState<number | null>(null);
  const [uploadingSkillIndex, setUploadingSkillIndex] = useState<number | null>(null);

  /**
   * Tombol yang harus difokus setelah sebuah baris berpindah posisi.
   *
   * `key={index}` membuat React memakai ulang node DOM di posisi yang sama, jadi
   * setelah "pindah ke bawah" fokus tetap di node lama — yang sekarang mengendalikan
   * baris **lain**. Pengguna keyboard yang menekan panah dua kali jadi memindahkan
   * dua item berbeda tanpa tahu. Fokus dipindahkan mengikuti itemnya.
   *
   * Ref, bukan state: nilainya tidak pernah dirender, dan menulisnya lewat
   * `setState` di dalam effect memicu render berantai. Effect-nya bergantung pada
   * ketiga daftar — itulah yang benar-benar berubah saat baris berpindah.
   */
  const pendingFocusRef = useRef<string | null>(null);

  useEffect(() => {
    const key = pendingFocusRef.current;
    if (!key) return;
    // Dibersihkan lewat ref, jadi tak ada render tambahan. Effect ini juga jalan
    // saat pengguna mengetik di field (daftarnya ikut berganti identitas), dan
    // ref yang kosong membuatnya berhenti di baris di atas.
    pendingFocusRef.current = null;
    document.querySelector<HTMLButtonElement>(`[data-move-key="${key}"]`)?.focus();
  }, [skillsList, expertsList, partnershipsList]);

  // File Upload Helpers
  const handleFileUpload = async (index: number, file: File) => {
    if (!file) return;
    setUploadingIndex(index);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // `expertisers` JSONB bebas-isi (bisa berisi `/images/expert-*.jpg`), jadi
      // yang disimpan URL, bukan path. Lihat catatan di `uploadCmsFileAction`.
      const { url } = await uploadCmsFileAction(formData);
      updateExpert(index, "avatar", url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengunggah gambar.");
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleHeroUpload = async (file: File) => {
    if (!file) return;
    setIsHeroUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // Kolom tersendiri, jadi yang dikirim balik ke server adalah path; URL-nya
      // hanya untuk pratinjau di form ini.
      const { path, url } = await uploadCmsFileAction(formData);
      setHeroImagePath(path);
      setHeroImagePreviewUrl(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengunggah gambar.");
    } finally {
      setIsHeroUploading(false);
    }
  };

  const handlePartnerLogoUpload = async (index: number, file: File) => {
    if (!file) return;
    setUploadingPartnerIndex(index);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { url } = await uploadCmsFileAction(formData);
      updatePartner(index, "logo_url", url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengunggah logo.");
    } finally {
      setUploadingPartnerIndex(null);
    }
  };

  const handleSkillIconUpload = async (index: number, file: File) => {
    if (!file) return;
    setUploadingSkillIndex(index);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { url } = await uploadCmsFileAction(formData);
      updateSkill(index, "icon_url", url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengunggah icon.");
    } finally {
      setUploadingSkillIndex(null);
    }
  };

  const [isHeroUploading, setIsHeroUploading] = useState(false);

  // Tab Helpers
  /**
   * Aktivasi otomatis: panah langsung mengganti panel yang tampil, bukan cuma
   * memindahkan fokus. Dipilih karena kelima panel sudah dirender dan
   * pergantiannya tak memuat apa pun — APG menganjurkan aktivasi otomatis justru
   * untuk kasus ini.
   */
  const selectTab = (value: TabValue, moveFocus: boolean) => {
    setLandingSubTab(value);
    if (moveFocus) {
      tablistRef.current
        ?.querySelector<HTMLButtonElement>(`[data-tab-value="${value}"]`)
        ?.focus();
    }
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    // Supaya panah tidak ikut menggulirkan halaman.
    event.preventDefault();

    if (event.key === "Home") return selectTab(TABS[0].value, true);
    if (event.key === "End") return selectTab(TABS[TABS.length - 1].value, true);

    const current = TABS.findIndex(t => t.value === landingSubTab);
    const step = event.key === "ArrowRight" ? 1 : -1;
    // Melingkar; `+ TABS.length` supaya modulo dari -1 tidak negatif.
    selectTab(TABS[(current + step + TABS.length) % TABS.length].value, true);
  };

  const panelClass = (value: TabValue) =>
    landingSubTab === value ? "space-y-4 animate-in fade-in duration-200" : "hidden";

  // Skills Helpers
  const moveSkill = (index: number, direction: "up" | "down") => {
    const updated = [...skillsList];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setSkillsList(updated);
    pendingFocusRef.current = `skill-${targetIndex}-${direction}`;
  };

  const addSkill = () => {
    setSkillsList([...skillsList, { name: "Keahlian Baru", desc: "Deskripsi keahlian...", link: "", icon_url: "" }]);
  };

  const removeSkill = (index: number) => {
    setSkillsList(skillsList.filter((_, i) => i !== index));
  };

  const updateSkill = (index: number, field: string, value: string) => {
    const updated = [...skillsList];
    updated[index][field] = value;
    setSkillsList(updated);
  };

  // Experts Helpers
  const moveExpert = (index: number, direction: "up" | "down") => {
    const updated = [...expertsList];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setExpertsList(updated);
    pendingFocusRef.current = `expert-${targetIndex}-${direction}`;
  };

  const addExpert = () => {
    setExpertsList([...expertsList, { name: "Nama Expert", role: "Jabatan/Role", avatar: "/images/expert-dadik.jpg" }]);
  };

  const removeExpert = (index: number) => {
    setExpertsList(expertsList.filter((_, i) => i !== index));
  };

  const updateExpert = (index: number, field: string, value: string) => {
    const updated = [...expertsList];
    updated[index][field] = value;
    setExpertsList(updated);
  };

  // Partners Helpers
  const movePartner = (index: number, direction: "up" | "down") => {
    const updated = [...partnershipsList];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setPartnershipsList(updated);
    pendingFocusRef.current = `partner-${targetIndex}-${direction}`;
  };

  const addPartner = () => {
    setPartnershipsList([...partnershipsList, { name: "Partner Baru", logo_url: "" }]);
  };

  const removePartner = (index: number) => {
    setPartnershipsList(partnershipsList.filter((_, i) => i !== index));
  };

  const updatePartner = (index: number, field: string, value: string) => {
    const updated = [...partnershipsList];
    updated[index][field] = value;
    setPartnershipsList(updated);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/*
        Sub-tab sebagai `role="tablist"` (temuan #11).

        Dulunya lima `<button>` biasa di dalam `<div>` tanpa semantik apa pun:
        pembaca layar mengumumkannya sebagai lima tombol lepas, tidak menyebut
        bahwa mereka satu kelompok, tidak menyebut mana yang sedang aktif, dan
        tidak menghubungkan satu pun dengan panel yang muncul di bawahnya.
        Satu-satunya penanda tab aktif adalah warna latar — informasi yang hanya
        sampai ke mata.

        `components/ui/tabs.tsx` di repo ini cuma shim tanpa ARIA sama sekali,
        jadi semantiknya ditulis di sini.
      */}
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Bagian pengaturan landing page"
        aria-orientation="horizontal"
        onKeyDown={handleTabKeyDown}
        className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-3"
      >
        {TABS.map(sub => {
          const selected = landingSubTab === sub.value;
          return (
            <button
              key={sub.value}
              type="button"
              role="tab"
              id={tabId(sub.value)}
              data-tab-value={sub.value}
              aria-selected={selected}
              aria-controls={panelId(sub.value)}
              // Roving tabindex: seluruh tablist menempati satu perhentian Tab,
              // perpindahan di dalamnya pakai panah. Tanpa ini, lima tab
              // menyumbat jalur Tab menuju form di bawahnya.
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(sub.value, false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selected
                  ? "bg-teal-50 text-teal-800 border border-teal-200"
                  : "text-slate-500 hover:text-slate-900 bg-slate-50 border border-transparent"
              }`}
            >
              {sub.label}
            </button>
          );
        })}
      </div>

      <form action={updateLandingPageSettingsAction} className="space-y-6 max-w-3xl">
        {/* Hidden Inputs untuk visual builder state */}
        <input type="hidden" name="skillsJson" value={JSON.stringify(skillsList)} />
        <input type="hidden" name="expertisersJson" value={JSON.stringify(expertsList)} />
        {/*
          Yang dikirim OBJECT PATH, bukan URL — field-nya ikut diganti nama jadi
          `heroImagePath`. Nama lama (`heroImageUrl`) justru yang mengundang bug
          ini: ia membuat pengiriman URL penuh kembali ke DB terlihat wajar.
        */}
        <input type="hidden" name="heroImagePath" value={heroImagePath} />
        <input type="hidden" name="partnershipsJson" value={JSON.stringify(partnershipsList)} />

        {/* Sub-tab 1: Hero */}
        <div
          role="tabpanel"
          id={panelId("hero")}
          aria-labelledby={tabId("hero")}
          tabIndex={0}
          className={panelClass("hero")}
        >
          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700" htmlFor="heroTitle">Hero Title *</label>
            <input
              className="form-input text-sm"
              id="heroTitle"
              name="heroTitle"
              defaultValue={landingSettings?.hero_title || "Accelerate Your Career with Academy Utero"}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700" htmlFor="heroDescription">Hero Description *</label>
            <textarea
              className="form-input text-sm min-h-[100px]"
              id="heroDescription"
              name="heroDescription"
              defaultValue={landingSettings?.hero_description || ""}
              required
            />
          </div>

          {/*
            `role="group"` + `aria-labelledby`, bukan `<label>` (temuan #14).
            Teks ini dulunya `<label>` tanpa `htmlFor` dan tanpa kontrol di
            dalamnya — dan `<label>` yang tak menunjuk apa pun tetap diumumkan
            sebagai label, jadi pembaca layar menyebut "Hero Image / Banner"
            sebagai nama kontrol yang tidak ada. Sebagai nama grup, teksnya
            sampai ke tempat yang benar tanpa mengaku-aku jadi label.
          */}
          <div className="form-field" role="group" aria-labelledby="heroImageGroupLabel">
            <p id="heroImageGroupLabel" className="form-label text-xs font-bold text-slate-700">Hero Image / Banner *</p>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
              {heroImagePreviewUrl ? (
                <div className="h-20 w-32 overflow-hidden rounded border border-slate-350 bg-slate-100 shrink-0">
                  <img src={heroImagePreviewUrl} alt="Pratinjau hero banner yang sedang terpasang" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="h-20 w-32 rounded border border-slate-300 bg-slate-100 flex items-center justify-center shrink-0 text-slate-400 text-xs font-bold">
                  No Image
                </div>
              )}
              <div className="space-y-2">
                <label className={`button-secondary text-xs h-9 py-0 px-3 min-h-0 flex items-center justify-center shrink-0 cursor-pointer bg-white border border-slate-200 hover:border-teal-500 hover:text-teal-700 font-bold ${uploadLabelFocus}`}>
                  <Upload size={14} className="mr-1.5" aria-hidden="true" />
                  {/* `role="status"` supaya perubahannya diumumkan; sebelumnya
                      "Mengunggah..." hanya terlihat, jadi pengguna pembaca layar
                      tidak pernah tahu unggahan sedang berjalan. */}
                  <span role="status">{isHeroUploading ? "Mengunggah..." : "Unggah Foto Baru"}</span>
                  {/*
                    `sr-only`, BUKAN `hidden` (temuan #14).

                    `display:none` mengeluarkan input file dari urutan Tab, dan
                    `<label>` sendiri tidak bisa difokus — jadi tombol unggah ini
                    dulunya **tak terjangkau keyboard sama sekali**: satu-satunya
                    cara memakainya adalah mengklik. `sr-only` menyisakannya
                    terfokus sambil tetap tak terlihat, dan cincin fokusnya
                    dipindahkan ke label lewat `focus-within`.
                  */}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-describedby="heroImageHelp"
                    // `aria-disabled`, bukan `disabled`: menonaktifkan elemen yang
                    // sedang difokus membuang fokus ke `<body>`, jadi pengguna
                    // keyboard kehilangan posisinya tepat saat unggahan dimulai.
                    aria-disabled={isHeroUploading}
                    onChange={(e) => {
                      if (isHeroUploading) return;
                      if (e.target.files && e.target.files[0]) {
                        handleHeroUpload(e.target.files[0]);
                      }
                    }}
                  />
                </label>
                <p id="heroImageHelp" className="text-[10px] text-slate-400">File format: JPG, PNG, WEBP. Rekomendasi rasio landscape.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-tab 2: Skills (Visual Builder) */}
        <div
          role="tabpanel"
          id={panelId("skills")}
          aria-labelledby={tabId("skills")}
          tabIndex={0}
          className={panelClass("skills")}
        >
          <div className="flex justify-between items-center">
            <div>
              {/* `<h4>` dinaikkan ke `<h2>` (temuan #17). Halaman induknya
                  (`app/dashboard/admin/landing/page.tsx`) memegang `<h1>`, jadi
                  `<h4>` melompati dua tingkat dan navigasi heading kehilangan
                  urutannya. Ukuran visualnya tak berubah — yang menentukan
                  kelas Tailwind, bukan tingkat elemennya. */}
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Daftar Skills Competencies</h2>
              <p className="text-[10px] text-slate-400">Susun dan urutkan keahlian yang diajarkan di Utero Academy.</p>
            </div>
            <button
              type="button"
              onClick={addSkill}
              className="button-secondary text-[10px] py-1 px-2.5 min-h-0 flex items-center gap-1 font-bold border-teal-200 text-teal-800 hover:bg-teal-50"
            >
              <Plus size={12} aria-hidden="true" />
              <span>Tambah Keahlian</span>
            </button>
          </div>

          <div className="grid gap-3">
            {skillsList.map((skill, index) => (
              <div key={index} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-between gap-4">
                <div className="grid gap-2 flex-1 sm:grid-cols-2 lg:grid-cols-4">
                  {/*
                    `aria-label` pada tiap field (temuan #14). Keempat input ini
                    dulunya hanya ber-`placeholder`, dan placeholder bukan nama
                    terakses: ia hilang begitu pengguna mengetik, dan sebagian
                    pembaca layar tak membacakannya sama sekali. Nomor barisnya
                    ikut masuk ke nama — tanpa itu, "Nama Keahlian" diumumkan
                    persis sama untuk setiap baris di daftar.
                  */}
                  <input
                    className="form-input text-xs bg-white"
                    aria-label={`Nama keahlian baris ${index + 1}`}
                    placeholder="Nama Keahlian (misal: Graphic Design)"
                    value={skill.name}
                    onChange={(e) => updateSkill(index, "name", e.target.value)}
                    required
                  />
                  <input
                    className="form-input text-xs bg-white"
                    aria-label={`Deskripsi keahlian baris ${index + 1}`}
                    placeholder="Deskripsi singkat keahlian..."
                    value={skill.desc}
                    onChange={(e) => updateSkill(index, "desc", e.target.value)}
                    required
                  />
                  <input
                    className="form-input text-xs bg-white"
                    aria-label={`Tautan keahlian baris ${index + 1} (opsional)`}
                    placeholder="Link Tautan Keahlian (opsional)"
                    value={skill.link || ""}
                    onChange={(e) => updateSkill(index, "link", e.target.value)}
                  />
                  <div className="flex gap-1.5 items-center">
                    <input
                      className="form-input text-xs bg-white flex-1 min-w-0"
                      aria-label={`URL icon keahlian baris ${index + 1} (opsional jika diunggah)`}
                      placeholder="URL Icon (opsional jika upload)"
                      value={skill.icon_url || ""}
                      onChange={(e) => updateSkill(index, "icon_url", e.target.value)}
                    />
                    <label className={`button-secondary text-xs h-9 py-0 px-2 min-h-0 flex items-center justify-center shrink-0 cursor-pointer bg-white border border-slate-200 hover:border-teal-500 hover:text-teal-700 ${uploadLabelFocus}`} title="Unggah Icon Baru">
                      {uploadingSkillIndex === index ? (
                        <span role="status" className="text-[9px] font-semibold text-slate-400">Mengunggah…</span>
                      ) : (
                        <Upload size={14} aria-hidden="true" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        // Label ini isinya cuma ikon, jadi tak menyumbang nama
                        // apa pun — namanya harus ditulis di sini.
                        aria-label={`Unggah icon keahlian baris ${index + 1}`}
                        aria-disabled={uploadingSkillIndex !== null}
                        onChange={(e) => {
                          if (uploadingSkillIndex !== null) return;
                          if (e.target.files && e.target.files[0]) {
                            handleSkillIconUpload(index, e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Order & Delete actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/*
                    `aria-disabled`, bukan `disabled` (temuan #14). Tombol
                    ber-`disabled` keluar dari urutan Tab, jadi jumlah kontrol per
                    baris berubah-ubah: baris pertama kehilangan "ke atas", baris
                    terakhir kehilangan "ke bawah". Pengguna keyboard yang
                    menyusuri daftar tidak bisa lagi mengandalkan ritme yang sama
                    di setiap baris. `aria-disabled` menyisakannya bisa difokus dan
                    diumumkan sebagai "dimmed"; penjaga di `onClick` yang menahan
                    aksinya.
                  */}
                  <button
                    type="button"
                    data-move-key={`skill-${index}-up`}
                    aria-disabled={index === 0}
                    onClick={() => { if (index === 0) return; moveSkill(index, "up"); }}
                    className="p-1 rounded hover:bg-slate-200 text-slate-500 aria-disabled:opacity-30 aria-disabled:cursor-not-allowed"
                    aria-label={`Pindahkan keahlian ${rowName(skill.name, index)} ke atas`}
                    title="Pindah Ke Atas"
                  >
                    <ArrowUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    data-move-key={`skill-${index}-down`}
                    aria-disabled={index === skillsList.length - 1}
                    onClick={() => { if (index === skillsList.length - 1) return; moveSkill(index, "down"); }}
                    className="p-1 rounded hover:bg-slate-200 text-slate-500 aria-disabled:opacity-30 aria-disabled:cursor-not-allowed"
                    aria-label={`Pindahkan keahlian ${rowName(skill.name, index)} ke bawah`}
                    title="Pindah Ke Bawah"
                  >
                    <ArrowDown size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSkill(index)}
                    className="p-1.5 rounded hover:bg-red-50 text-red-500 border border-transparent hover:border-red-200"
                    aria-label={`Hapus keahlian ${rowName(skill.name, index)}`}
                    title="Hapus Keahlian"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-tab 3: Experts (Visual Builder) */}
        <div
          role="tabpanel"
          id={panelId("experts")}
          aria-labelledby={tabId("experts")}
          tabIndex={0}
          className={panelClass("experts")}
        >
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Daftar Tim Expert / Mentor</h2>
              <p className="text-[10px] text-slate-400">Susun dan urutkan expert yang muncul di landing page.</p>
            </div>
            <button
              type="button"
              onClick={addExpert}
              className="button-secondary text-[10px] py-1 px-2.5 min-h-0 flex items-center gap-1.5 font-bold border-teal-200 text-teal-800 hover:bg-teal-50"
            >
              <Plus size={12} aria-hidden="true" />
              <span>Tambah Expert</span>
            </button>
          </div>

          <div className="grid gap-3">
            {expertsList.map((exp, index) => (
              <div key={index} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-between gap-4">
                <div className="grid gap-2 flex-1 sm:grid-cols-3">
                  <input
                    className="form-input text-xs bg-white"
                    aria-label={`Nama expert baris ${index + 1}`}
                    placeholder="Nama Mentor"
                    value={exp.name}
                    onChange={(e) => updateExpert(index, "name", e.target.value)}
                    required
                  />
                  <input
                    className="form-input text-xs bg-white"
                    aria-label={`Jabatan expert baris ${index + 1}`}
                    placeholder="Jabatan/Role (misal: BRAND CONSULTANT)"
                    value={exp.role}
                    onChange={(e) => updateExpert(index, "role", e.target.value)}
                    required
                  />
                  <div className="flex gap-1.5 items-center">
                    <input
                      className="form-input text-xs bg-white flex-1 min-w-0"
                      aria-label={`Path foto expert baris ${index + 1}`}
                      placeholder="Path Foto (misal: /images/expert-dadik.jpg)"
                      value={exp.avatar}
                      onChange={(e) => updateExpert(index, "avatar", e.target.value)}
                      required
                    />
                    <label className={`button-secondary text-xs h-9 py-0 px-2 min-h-0 flex items-center justify-center shrink-0 cursor-pointer bg-white border border-slate-200 hover:border-teal-500 hover:text-teal-700 ${uploadLabelFocus}`} title="Unggah Foto Baru">
                      {uploadingIndex === index ? (
                        <span role="status" className="text-[9px] font-semibold text-slate-400">Mengunggah…</span>
                      ) : (
                        <Upload size={14} aria-hidden="true" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        aria-label={`Unggah foto expert baris ${index + 1}`}
                        aria-disabled={uploadingIndex !== null}
                        onChange={(e) => {
                          if (uploadingIndex !== null) return;
                          if (e.target.files && e.target.files[0]) {
                            handleFileUpload(index, e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Order & Delete actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    data-move-key={`expert-${index}-up`}
                    aria-disabled={index === 0}
                    onClick={() => { if (index === 0) return; moveExpert(index, "up"); }}
                    className="p-1 rounded hover:bg-slate-200 text-slate-500 aria-disabled:opacity-30 aria-disabled:cursor-not-allowed"
                    aria-label={`Pindahkan expert ${rowName(exp.name, index)} ke atas`}
                    title="Pindah Ke Atas"
                  >
                    <ArrowUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    data-move-key={`expert-${index}-down`}
                    aria-disabled={index === expertsList.length - 1}
                    onClick={() => { if (index === expertsList.length - 1) return; moveExpert(index, "down"); }}
                    className="p-1 rounded hover:bg-slate-200 text-slate-500 aria-disabled:opacity-30 aria-disabled:cursor-not-allowed"
                    aria-label={`Pindahkan expert ${rowName(exp.name, index)} ke bawah`}
                    title="Pindah Ke Bawah"
                  >
                    <ArrowDown size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeExpert(index)}
                    className="p-1.5 rounded hover:bg-red-50 text-red-500 border border-transparent hover:border-red-200"
                    aria-label={`Hapus expert ${rowName(exp.name, index)}`}
                    title="Hapus Expert"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-tab 3.5: Partnerships Logos */}
        <div
          role="tabpanel"
          id={panelId("partners")}
          aria-labelledby={tabId("partners")}
          tabIndex={0}
          className={panelClass("partners")}
        >
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Logo Partner & Kerjasama</h2>
              <p className="text-[10px] text-slate-400">Susun dan unggah logo partner / sponsor Utero Academy.</p>
            </div>
            <button
              type="button"
              onClick={addPartner}
              className="button-secondary text-[10px] py-1 px-2.5 min-h-0 flex items-center gap-1.5 font-bold border-teal-200 text-teal-800 hover:bg-teal-50"
            >
              <Plus size={12} aria-hidden="true" />
              <span>Tambah Partner</span>
            </button>
          </div>

          <div className="grid gap-3">
            {partnershipsList.map((partner, index) => (
              <div key={index} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-between gap-4">
                <div className="grid gap-2 flex-1 sm:grid-cols-2">
                  <input
                    className="form-input text-xs bg-white animate-none"
                    aria-label={`Nama partner baris ${index + 1}`}
                    placeholder="Nama Partner (misal: YAMAHA)"
                    value={partner.name}
                    onChange={(e) => updatePartner(index, "name", e.target.value)}
                    required
                  />
                  <div className="flex gap-1.5 items-center">
                    <input
                      className="form-input text-xs bg-white flex-1 min-w-0"
                      aria-label={`URL logo partner baris ${index + 1} (opsional jika diunggah)`}
                      placeholder="URL Logo (opsional jika upload)"
                      value={partner.logo_url}
                      onChange={(e) => updatePartner(index, "logo_url", e.target.value)}
                    />
                    <label className={`button-secondary text-xs h-9 py-0 px-2 min-h-0 flex items-center justify-center shrink-0 cursor-pointer bg-white border border-slate-200 hover:border-teal-500 hover:text-teal-700 ${uploadLabelFocus}`} title="Unggah Logo Partner">
                      {uploadingPartnerIndex === index ? (
                        <span role="status" className="text-[9px] font-semibold text-slate-400">Mengunggah…</span>
                      ) : (
                        <Upload size={14} aria-hidden="true" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        aria-label={`Unggah logo partner baris ${index + 1}`}
                        aria-disabled={uploadingPartnerIndex !== null}
                        onChange={(e) => {
                          if (uploadingPartnerIndex !== null) return;
                          if (e.target.files && e.target.files[0]) {
                            handlePartnerLogoUpload(index, e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Order & Delete actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    data-move-key={`partner-${index}-up`}
                    aria-disabled={index === 0}
                    onClick={() => { if (index === 0) return; movePartner(index, "up"); }}
                    className="p-1 rounded hover:bg-slate-200 text-slate-500 aria-disabled:opacity-30 aria-disabled:cursor-not-allowed"
                    aria-label={`Pindahkan partner ${rowName(partner.name, index)} ke atas`}
                    title="Pindah Ke Atas"
                  >
                    <ArrowUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    data-move-key={`partner-${index}-down`}
                    aria-disabled={index === partnershipsList.length - 1}
                    onClick={() => { if (index === partnershipsList.length - 1) return; movePartner(index, "down"); }}
                    className="p-1 rounded hover:bg-slate-200 text-slate-500 aria-disabled:opacity-30 aria-disabled:cursor-not-allowed"
                    aria-label={`Pindahkan partner ${rowName(partner.name, index)} ke bawah`}
                    title="Pindah Ke Bawah"
                  >
                    <ArrowDown size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePartner(index)}
                    className="p-1.5 rounded hover:bg-red-50 text-red-500 border border-transparent hover:border-red-200"
                    aria-label={`Hapus partner ${rowName(partner.name, index)}`}
                    title="Hapus Partner"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-tab 4: Halaman Lain (About, Kontak, T&C) */}
        <div
          role="tabpanel"
          id={panelId("pages")}
          aria-labelledby={tabId("pages")}
          tabIndex={0}
          className={panelClass("pages")}
        >
          {/* Tentang Kami / About Us */}
          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700" htmlFor="aboutText">Tentang Kami (About Us Text)</label>
            <p id="aboutTextHelp" className="text-[10px] text-slate-400 mb-1">Teks profil/sejarah lembaga. Akan ditampilkan secara dinamis di halaman publik <strong>&quot;/about&quot;</strong>.</p>
            <textarea
              className="form-input text-sm min-h-[80px]"
              id="aboutText"
              name="aboutText"
              aria-describedby="aboutTextHelp"
              defaultValue={landingSettings?.about_text || ""}
            />
          </div>

          {/* Kontak & Alamat */}
          {/* `role="group"` + `aria-labelledby`: ketiga field kontak dulunya
              didahului `<p>` lepas yang menerangkan ketiganya sekaligus, tapi
              tidak terikat ke satu pun — jadi keterangan itu tak pernah
              terdengar bersama field-nya. */}
          <div role="group" aria-labelledby="contactGroupLabel" className="space-y-3">
            <p id="contactGroupLabel" className="text-[10px] text-slate-400">Informasi kontak &amp; peta instansi. Akan ditampilkan secara dinamis di halaman publik <strong>&quot;/contact&quot;</strong>.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="form-field">
                <label className="form-label text-xs font-bold text-slate-700" htmlFor="contactEmail">Email Instansi</label>
                <input
                  type="email"
                  className="form-input text-sm"
                  id="contactEmail"
                  name="contactEmail"
                  defaultValue={landingSettings?.contact_email || ""}
                />
              </div>
              <div className="form-field">
                <label className="form-label text-xs font-bold text-slate-700" htmlFor="contactPhone">Nomor Telepon/WA</label>
                <input
                  className="form-input text-sm"
                  id="contactPhone"
                  name="contactPhone"
                  defaultValue={landingSettings?.contact_phone || ""}
                />
              </div>
            </div>

            <div className="form-field">
              <label className="form-label text-xs font-bold text-slate-700" htmlFor="contactAddress">Alamat Lengkap</label>
              <input
                className="form-input text-sm"
                id="contactAddress"
                name="contactAddress"
                defaultValue={landingSettings?.contact_address || ""}
              />
            </div>
          </div>

          {/* Syarat & Ketentuan / Terms */}
          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700" htmlFor="termsContent">Syarat &amp; Ketentuan (Terms &amp; Conditions)</label>
            <p id="termsContentHelp" className="text-[10px] text-slate-400 mb-1">Dokumen tata tertib &amp; legalitas magang. Akan ditampilkan secara dinamis di halaman publik <strong>&quot;/terms&quot;</strong>.</p>
            <textarea
              className="form-input text-sm min-h-[80px]"
              id="termsContent"
              name="termsContent"
              aria-describedby="termsContentHelp"
              defaultValue={landingSettings?.terms_content || ""}
            />
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            className="button-primary text-sm font-bold flex items-center gap-1.5"
          >
            <Save size={16} aria-hidden="true" />
            <span>Simpan Pengaturan</span>
          </button>
        </div>
      </form>
    </div>
  );
}
