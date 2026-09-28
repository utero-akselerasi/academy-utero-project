"use client";

import { useRef, useState } from "react";
import {
  createFaqAction, deleteFaqAction,
  createTestimonialAction, deleteTestimonialAction, publishTestimonialAction,
  createGalleryAction, deleteGalleryAction,
  createArticleAction, deleteArticleAction
} from "@/features/cms/actions";
import { type CmsSite, type Faq, type Testimonial, type Gallery, type Article } from "./types";
import { ImagePreview } from "@/features/daily-reports/ImagePreview";
import { Modal } from "@/components/ui/modal";
import { Trash2, PlusCircle, HelpCircle, FileText, Image as ImageIcon, MessageSquare, ExternalLink } from "lucide-react";

type Props = {
  site: CmsSite;
  faqs: Faq[];
  testimonials: Testimonial[];
  galleries: Gallery[];
  articles: Article[];
};

type TabValue = "articles" | "faqs" | "testimonials" | "galleries";

/**
 * Urutan tab dipakai dua kali: untuk merender tombol, dan untuk menentukan
 * tetangga saat tombol panah ditekan (temuan #11). Menaruhnya di satu tempat
 * mencegah keduanya menyimpang.
 */
const TAB_ORDER: TabValue[] = ["articles", "faqs", "testimonials", "galleries"];

export function CmsManager({ site, faqs, testimonials, galleries, articles }: Props) {
  const [activeTab, setActiveTab] = useState<TabValue>("articles");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  /**
   * Referensi ke keempat tombol tab, untuk memindahkan fokus saat panah ditekan.
   *
   * Pola tab APG memakai **roving tabindex**: hanya tab terpilih yang punya
   * `tabIndex={0}`, sisanya `-1`. Jadi Tab masuk ke tablist sekali lalu langsung
   * keluar ke panelnya — tidak menelusuri keempat tab satu per satu — dan
   * perpindahan antar tab jadi tugas tombol panah. Karena tab yang tidak terpilih
   * tak bisa menerima fokus lewat Tab, fokusnya harus dipindah lewat kode.
   */
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>, actionFn: (fd: FormData) => Promise<void>) => {
    e.preventDefault();
    setIsPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.set("siteId", site.id);
      await actionFn(formData);
      handleCloseModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menyimpan data.");
    } finally {
      setIsPending(false);
    }
  };

  /**
   * Navigasi tombol panah/Home/End di dalam tablist.
   *
   * Aktivasi otomatis (fokus sekaligus memilih) dipakai, bukan manual: APG
   * menganjurkannya kalau menampilkan panel tidak mahal, dan di sini panelnya
   * sudah dirender dari data yang ada di klien. Dengan aktivasi manual pengguna
   * harus menekan Enter setelah setiap panah, yang tak cocok dengan perilaku
   * klik yang sudah ada.
   */
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const current = TAB_ORDER.indexOf(activeTab);
    let next = -1;

    if (event.key === "ArrowRight") next = (current + 1) % TAB_ORDER.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TAB_ORDER.length - 1;
    else return;

    // `preventDefault` supaya Home/End tidak menggulirkan halaman sekaligus.
    event.preventDefault();
    const target = TAB_ORDER[next];
    setActiveTab(target);
    tabRefs.current[target]?.focus();
  };

  return (
    <div className="space-y-6">
      {/* Header Info Website */}
      <section className="surface p-5 bg-white border border-slate-200 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
        <div>
          <span className="text-[10px] font-black uppercase text-teal-700">Website CMS</span>
          <h2 className="text-2xl font-black text-slate-900 mt-0.5">{site.name}</h2>
          <p className="text-xs text-slate-500 font-semibold mt-1 flex items-center gap-1">
            <ExternalLink size={13} className="text-slate-400" aria-hidden="true" />
            <span>Domain: <a href={`http://${site.domain}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-teal-700">{site.domain}</a></span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="button-primary text-xs py-2 min-h-0 flex items-center gap-1.5 font-bold"
        >
          <PlusCircle size={15} aria-hidden="true" />
          <span>Tambah Konten Baru</span>
        </button>
      </section>

      {/*
        Tabs CMS (temuan #11 dan #7).

        Sebelumnya keempat tab hanya `<button>` biasa: keadaan terpilih ada
        semata-mata sebagai warna garis bawah, jadi pengguna pembaca layar tidak
        punya cara tahu tab mana yang aktif — dan `focus:outline-none` di kelasnya
        menghapus cincin fokus tanpa ganti, jadi pengguna keyboard pun kehilangan
        jejak. Kelas itu dibuang; `:focus-visible` global di `globals.css` yang
        menggantikannya.
      */}
      <div
        role="tablist"
        aria-label="Jenis konten CMS"
        className="flex gap-2 border-b border-slate-200 pb-px"
      >
        {[
          { label: "Artikel / Blog", value: "articles" as const, icon: FileText, count: articles.length },
          { label: "FAQ Halaman", value: "faqs" as const, icon: HelpCircle, count: faqs.length },
          { label: "Testimoni Alumni", value: "testimonials" as const, icon: MessageSquare, count: testimonials.length },
          { label: "Galeri Foto", value: "galleries" as const, icon: ImageIcon, count: galleries.length }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              ref={(node) => { tabRefs.current[tab.value] = node; }}
              type="button"
              role="tab"
              id={`cms-tab-${tab.value}`}
              aria-selected={isActive}
              aria-controls={`cms-panel-${tab.value}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.value)}
              onKeyDown={handleTabKeyDown}
              className={`flex items-center gap-1.5 px-4 py-3 border-b-2 text-xs font-bold transition-all -mb-px ${
                isActive
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-slate-500 hover:text-slate-950"
              }`}
            >
              <Icon size={14} aria-hidden="true" />
              <span>{tab.label}</span>
              {/*
                Angkanya sudah masuk nama terakses tombol lewat teks di dalamnya,
                jadi tidak perlu `aria-label` terpisah — tapi tanpa satuan ia
                terbaca sebagai angka menggantung. `sr-only` menyediakan katanya
                hanya untuk pembaca layar.
              */}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                isActive ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-500"
              }`}>
                {tab.count}
                <span className="sr-only"> item</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* RENDER KONTEN TAB LIST */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {/*
          `tabIndex={0}` pada panel: panel yang isinya tidak punya elemen fokusable
          pertama (mis. daftar kosong) harus tetap bisa menerima fokus, kalau tidak
          Tab setelah tablist melompati seluruh isinya.
        */}
        {/* Tab 1: Artikel */}
        {activeTab === "articles" && (
          <div
            role="tabpanel"
            id="cms-panel-articles"
            aria-labelledby="cms-tab-articles"
            tabIndex={0}
            className="divide-y divide-slate-100 outline-none"
          >
            {articles.length === 0 ? (
              <p className="p-8 text-center text-slate-500 text-sm">Belum ada artikel yang diterbitkan.</p>
            ) : (
              articles.map(art => (
                <div key={art.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-all text-xs font-semibold">
                  <div className="min-w-0 flex items-center gap-3 flex-1">
                    {art.cover_path && (
                      <div className="h-12 w-16 overflow-hidden rounded border border-slate-200 bg-slate-100 shrink-0">
                        <ImagePreview src={art.cover_path} alt={art.title} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div className="truncate">
                      <span className="font-bold text-slate-900 block truncate">{art.title}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5 font-mono truncate">/{art.slug}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-50 border border-teal-200 text-teal-800">
                      {art.status}
                    </span>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (confirm("Hapus artikel ini?")) {
                          await deleteArticleAction(new FormData(e.currentTarget));
                        }
                      }}
                    >
                      <input name="artId" type="hidden" value={art.id} />
                      {/*
                        Nama terakses menyebut judul artikelnya (temuan #13).
                        "Hapus" saja tidak cukup: di daftar ini ada satu tombol
                        seperti itu per baris, jadi seluruhnya terdengar identik
                        dan tidak ada cara tahu mana yang akan dihapus.
                      */}
                      <button
                        type="submit"
                        aria-label={`Hapus artikel ${art.title}`}
                        className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 flex items-center justify-center"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: FAQ */}
        {activeTab === "faqs" && (
          <div
            role="tabpanel"
            id="cms-panel-faqs"
            aria-labelledby="cms-tab-faqs"
            tabIndex={0}
            className="divide-y divide-slate-100 outline-none"
          >
            {faqs.length === 0 ? (
              <p className="p-8 text-center text-slate-500 text-sm">Belum ada FAQ.</p>
            ) : (
              faqs.map(faq => (
                <div key={faq.id} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50/50 transition-all text-xs font-semibold">
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="font-bold text-slate-900 block leading-snug">Q: {faq.question}</span>
                    <p className="text-xs text-slate-600 leading-relaxed font-normal bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      A: {faq.answer}
                    </p>
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (confirm("Hapus FAQ ini?")) {
                        await deleteFaqAction(new FormData(e.currentTarget));
                      }
                    }}
                    className="shrink-0 mt-0.5"
                  >
                    <input name="faqId" type="hidden" value={faq.id} />
                    <button
                      type="submit"
                      aria-label={`Hapus FAQ: ${faq.question}`}
                      className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 flex items-center justify-center"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Testimoni */}
        {activeTab === "testimonials" && (
          <div
            role="tabpanel"
            id="cms-panel-testimonials"
            aria-labelledby="cms-tab-testimonials"
            tabIndex={0}
            className="divide-y divide-slate-100 outline-none"
          >
            {testimonials.length === 0 ? (
              <p className="p-8 text-center text-slate-500 text-sm">Belum ada testimoni.</p>
            ) : (
              testimonials.map(test => (
                <div key={test.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-all text-xs font-semibold">
                  <div className="min-w-0 flex items-center gap-3 flex-1">
                    {test.photo_path && (
                      <div className="h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100 shrink-0">
                        <ImagePreview src={test.photo_path} alt={test.name} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 block truncate">{test.name}</span>
                        {test.status === "draft" && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-50 border border-amber-200 text-amber-800 uppercase">
                            Draft
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5 truncate">{test.role || "Alumni"}</span>
                      <p className="text-[11px] text-slate-600 font-normal mt-1 italic line-clamp-1">&ldquo;{test.quote}&rdquo;</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {test.status === "draft" && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (confirm("Setujui & publikasikan testimoni ini ke halaman utama?")) {
                            await publishTestimonialAction(new FormData(e.currentTarget));
                          }
                        }}
                      >
                        <input name="testId" type="hidden" value={test.id} />
                        {/*
                          Tombol ini punya teks, jadi namanya tidak kosong — tapi
                          "Setujui" berulang sekali per baris. `aria-label`
                          menyebut siapa yang disetujui.
                        */}
                        <button
                          type="submit"
                          aria-label={`Setujui dan terbitkan testimoni ${test.name}`}
                          className="text-xs px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold flex items-center gap-1"
                        >
                          Setujui
                        </button>
                      </form>
                    )}
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (confirm("Hapus testimoni ini?")) {
                          await deleteTestimonialAction(new FormData(e.currentTarget));
                        }
                      }}
                    >
                      <input name="testId" type="hidden" value={test.id} />
                      <button
                        type="submit"
                        aria-label={`Hapus testimoni ${test.name}`}
                        className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 flex items-center justify-center"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 4: Galeri */}
        {activeTab === "galleries" && (
          <div
            role="tabpanel"
            id="cms-panel-galleries"
            aria-labelledby="cms-tab-galleries"
            tabIndex={0}
            className="p-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 outline-none"
          >
            {galleries.length === 0 ? (
              <p className="p-8 text-center text-slate-500 text-sm col-span-full">Belum ada foto galeri.</p>
            ) : (
              galleries.map(gal => (
                <div key={gal.id} className="surface p-2 border border-slate-200 rounded-xl bg-slate-50/20 flex flex-col justify-between hover:border-teal-500/30 transition-all">
                  <div className="w-full">
                    <div className="h-28 overflow-hidden rounded bg-slate-100 relative group">
                      {/*
                        `image_path` dulu bertipe `string` non-null, jadi tidak
                        pernah ada cabang kosong. Setelah resolusi di `getCmsData()`
                        ia bisa `null` — objek yatim (baris DB ada, berkasnya tidak)
                        wajar di data ini karena repo belum punya `storage.remove()`.
                      */}
                      {gal.image_path ? (
                        <ImagePreview src={gal.image_path} alt={gal.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-slate-400">
                          Gambar tidak tersedia
                        </div>
                      )}
                    </div>
                    {/*
                      `title` dipertahankan di sini. Ia bermasalah kalau jadi
                      SATU-SATUNYA nama sebuah kontrol (temuan #14), tapi ini teks
                      biasa yang terpotong `truncate` — teks lengkapnya sudah utuh
                      di pohon aksesibilitas, dan `title` hanya menambah cara
                      melihatnya bagi pengguna tetikus.
                    */}
                    <h4 className="text-xs font-bold text-slate-900 mt-2 truncate" title={gal.title}>{gal.title}</h4>
                    {gal.description && (
                      <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{gal.description}</p>
                    )}
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (confirm("Hapus foto galeri ini?")) {
                          await deleteGalleryAction(new FormData(e.currentTarget));
                        }
                      }}
                    >
                      <input name="galleryId" type="hidden" value={gal.id} />
                      <button
                        type="submit"
                        aria-label={`Hapus foto galeri ${gal.title}`}
                        className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 flex items-center justify-center"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/*
        POPUP MODAL ADD CONTENT — dipindah ke `Modal` bersama (temuan #2, #13).

        `onClose` menolak saat `isPending`, seperti tombol `X` lama yang
        `disabled`: menutup di tengah unggahan berkas akan melepas form selagi
        server action masih berjalan.

        Judul visual dipertahankan di dalam isi dan judul dialognya `hideTitle`,
        karena judul untuk pembaca layar dibuat lebih spesifik daripada yang
        terlihat — ia menyebut situs mana yang sedang disunting, yang di layar
        sudah terlihat dari konteks halaman tapi tidak ikut diumumkan.
      */}
      <Modal
        open={isModalOpen}
        onClose={() => {
          if (isPending) return;
          handleCloseModal();
        }}
        title={`Tambah konten baru untuk ${site.name}`}
        hideTitle
        closeLabel="Tutup form tambah konten"
        panelClassName="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] overflow-y-auto"
        headerClassName="absolute top-4 right-5 z-10"
        closeClassName="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
      >
        <>
          {/* Header Modal */}
          <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
            <h3 className="text-base font-black text-slate-900">
              {activeTab === "articles" && "Tambah Artikel Baru"}
              {activeTab === "faqs" && "Tambah FAQ Baru"}
              {activeTab === "testimonials" && "Tambah Testimoni Baru"}
              {activeTab === "galleries" && "Tambah Foto Galeri Baru"}
            </h3>
          </div>

          {/*
            FORM TAMBAH KONTEN DETAIL

            Setiap `<label>` dapat `htmlFor` dan setiap kontrol dapat `id`
            (temuan #3). Sebelumnya labelnya hanya berdekatan secara visual, tanpa
            hubungan program: pembaca layar mengumumkan "edit teks" kosong, dan
            satu-satunya petunjuk isinya adalah `placeholder` — yang hilang begitu
            pengguna mulai menaip, jadi tidak bisa diandalkan sebagai label.

            Id-nya diberi awalan `cms-` supaya tidak bertabrakan dengan id lain di
            halaman; dua field bernama `title` ada di dua form berbeda (artikel dan
            galeri), jadi awalan per-form juga dibutuhkan.
          */}
          {activeTab === "articles" && (
            <form onSubmit={(e) => handleFormSubmit(e, createArticleAction)} className="p-6 space-y-4">
              <div className="form-field">
                <label className="form-label text-xs" htmlFor="cms-article-title">Judul Artikel *</label>
                <input className="form-input text-sm" id="cms-article-title" name="title" required placeholder="Contoh: Info Pembukaan Magang Batch 5" />
              </div>
              <div className="form-field">
                <label className="form-label text-xs" htmlFor="cms-article-excerpt">Ringkasan Artikel</label>
                <input className="form-input text-sm" id="cms-article-excerpt" name="excerpt" placeholder="Tulis ringkasan singkat berita..." />
              </div>
              <div className="form-field">
                <label className="form-label text-xs" htmlFor="cms-article-content">Konten Isi Artikel *</label>
                <textarea className="form-input text-xs" id="cms-article-content" name="content" required rows={4} placeholder="Tulis isi berita selengkapnya..." />
              </div>
              <div className="form-field">
                <label className="form-label text-xs" htmlFor="cms-article-cover">Gambar Cover Artikel</label>
                <input type="file" id="cms-article-cover" name="cover" accept="image/*" className="form-input text-xs" />
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button type="button" onClick={handleCloseModal} className="button-secondary text-xs h-9 min-h-0" disabled={isPending}>Batal</button>
                <button type="submit" className="button-primary text-xs h-9 min-h-0 font-bold" disabled={isPending}>
                  {isPending ? "Memproses..." : "Terbitkan"}
                </button>
              </div>
            </form>
          )}

          {activeTab === "faqs" && (
            <form onSubmit={(e) => handleFormSubmit(e, createFaqAction)} className="p-6 space-y-4">
              <div className="form-field">
                <label className="form-label text-xs" htmlFor="cms-faq-question">Pertanyaan (Question) *</label>
                <input className="form-input text-sm" id="cms-faq-question" name="question" required placeholder="Contoh: Apakah magang ini berbayar?" />
              </div>
              <div className="form-field">
                <label className="form-label text-xs" htmlFor="cms-faq-answer">Jawaban (Answer) *</label>
                <textarea className="form-input text-xs" id="cms-faq-answer" name="answer" required rows={3} placeholder="Tuliskan penjelasan jawabannya..." />
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button type="button" onClick={handleCloseModal} className="button-secondary text-xs h-9 min-h-0" disabled={isPending}>Batal</button>
                <button type="submit" className="button-primary text-xs h-9 min-h-0 font-bold" disabled={isPending}>
                  {isPending ? "Memproses..." : "Simpan FAQ"}
                </button>
              </div>
            </form>
          )}

          {activeTab === "testimonials" && (
            <form onSubmit={(e) => handleFormSubmit(e, createTestimonialAction)} className="p-6 space-y-4">
              <div className="form-field">
                <label className="form-label text-xs" htmlFor="cms-testimonial-name">Nama Lengkap *</label>
                <input className="form-input text-sm" id="cms-testimonial-name" name="name" required placeholder="Contoh: Andika Wijaya" />
              </div>
              <div className="form-field">
                <label className="form-label text-xs" htmlFor="cms-testimonial-role">Keterangan / Alumni *</label>
                <input className="form-input text-sm" id="cms-testimonial-role" name="role" required placeholder="Contoh: Alumni Magang SMK 1 Malang" />
              </div>
              <div className="form-field">
                <label className="form-label text-xs" htmlFor="cms-testimonial-quote">Kutipan Testimoni (Quote) *</label>
                <textarea className="form-input text-xs" id="cms-testimonial-quote" name="quote" required rows={3} placeholder="Tulis isi testimoni..." />
              </div>
              <div className="form-field">
                <label className="form-label text-xs" htmlFor="cms-testimonial-photo">Foto Profil</label>
                <input type="file" id="cms-testimonial-photo" name="photo" accept="image/*" className="form-input text-xs" />
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button type="button" onClick={handleCloseModal} className="button-secondary text-xs h-9 min-h-0" disabled={isPending}>Batal</button>
                <button type="submit" className="button-primary text-xs h-9 min-h-0 font-bold" disabled={isPending}>
                  {isPending ? "Memproses..." : "Simpan Testimoni"}
                </button>
              </div>
            </form>
          )}

          {activeTab === "galleries" && (
            <form onSubmit={(e) => handleFormSubmit(e, createGalleryAction)} className="p-6 space-y-4">
              <div className="form-field">
                <label className="form-label text-xs" htmlFor="cms-gallery-title">Judul Foto Kegiatan *</label>
                <input className="form-input text-sm" id="cms-gallery-title" name="title" required placeholder="Contoh: Sesi Evaluasi Mentor Harian" />
              </div>
              <div className="form-field">
                <label className="form-label text-xs" htmlFor="cms-gallery-description">Deskripsi Singkat Kegiatan</label>
                <input className="form-input text-sm" id="cms-gallery-description" name="description" placeholder="Tulis keterangan foto..." />
              </div>
              <div className="form-field">
                <label className="form-label text-xs" htmlFor="cms-gallery-image">Pilih Gambar Kegiatan *</label>
                <input type="file" id="cms-gallery-image" name="image" accept="image/*" required className="form-input text-xs" />
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button type="button" onClick={handleCloseModal} className="button-secondary text-xs h-9 min-h-0" disabled={isPending}>Batal</button>
                <button type="submit" className="button-primary text-xs h-9 min-h-0 font-bold" disabled={isPending}>
                  {isPending ? "Memproses..." : "Upload Gambar"}
                </button>
              </div>
            </form>
          )}
        </>
      </Modal>
    </div>
  );
}
