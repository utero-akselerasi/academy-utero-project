"use client";

import { useState } from "react";
import { 
  createFaqAction, deleteFaqAction, 
  createTestimonialAction, deleteTestimonialAction, publishTestimonialAction,
  createGalleryAction, deleteGalleryAction,
  createArticleAction, deleteArticleAction
} from "@/features/cms/actions";
import { type CmsSite, type Faq, type Testimonial, type Gallery, type Article } from "./types";
import { ImagePreview } from "@/features/daily-reports/ImagePreview";
import { Plus, Trash2, X, PlusCircle, HelpCircle, FileText, Image as ImageIcon, MessageSquare, ExternalLink } from "lucide-react";

type Props = {
  site: CmsSite;
  faqs: Faq[];
  testimonials: Testimonial[];
  galleries: Gallery[];
  articles: Article[];
};

export function CmsManager({ site, faqs, testimonials, galleries, articles }: Props) {
  const [activeTab, setActiveTab] = useState<"articles" | "faqs" | "testimonials" | "galleries">("articles");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* Header Info Website */}
      <section className="surface p-5 bg-white border border-slate-200 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
        <div>
          <span className="text-[10px] font-black uppercase text-teal-700">Website CMS</span>
          <h2 className="text-2xl font-black text-slate-900 mt-0.5">{site.name}</h2>
          <p className="text-xs text-slate-500 font-semibold mt-1 flex items-center gap-1">
            <ExternalLink size={13} className="text-slate-400" />
            <span>Domain: <a href={`http://${site.domain}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-teal-700">{site.domain}</a></span>
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="button-primary text-xs py-2 min-h-0 flex items-center gap-1.5 font-bold"
        >
          <PlusCircle size={15} />
          <span>Tambah Konten Baru</span>
        </button>
      </section>

      {/* Tabs Menu CMS */}
      <div className="flex gap-2 border-b border-slate-200 pb-px">
        {[
          { label: "Artikel / Blog", value: "articles", icon: FileText, count: articles.length },
          { label: "FAQ Halaman", value: "faqs", icon: HelpCircle, count: faqs.length },
          { label: "Testimoni Alumni", value: "testimonials", icon: MessageSquare, count: testimonials.length },
          { label: "Galeri Foto", value: "galleries", icon: ImageIcon, count: galleries.length }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value as any)}
              className={`flex items-center gap-1.5 px-4 py-3 border-b-2 text-xs font-bold transition-all -mb-px focus:outline-none ${
                isActive
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-slate-500 hover:text-slate-950"
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                isActive ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-500"
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* RENDER KONTEN TAB LIST */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Tab 1: Artikel */}
        {activeTab === "articles" && (
          <div className="divide-y divide-slate-100">
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
                      <button type="submit" className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 flex items-center justify-center">
                        <Trash2 size={15} />
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
          <div className="divide-y divide-slate-100">
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
                    <button type="submit" className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 flex items-center justify-center">
                      <Trash2 size={15} />
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Testimoni */}
        {activeTab === "testimonials" && (
          <div className="divide-y divide-slate-100">
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
                      <p className="text-[11px] text-slate-600 font-normal mt-1 italic line-clamp-1">"{test.quote}"</p>
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
                        <button type="submit" className="text-xs px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold flex items-center gap-1">
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
                      <button type="submit" className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 flex items-center justify-center">
                        <Trash2 size={15} />
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
          <div className="p-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {galleries.length === 0 ? (
              <p className="p-8 text-center text-slate-500 text-sm col-span-full">Belum ada foto galeri.</p>
            ) : (
              galleries.map(gal => (
                <div key={gal.id} className="surface p-2 border border-slate-200 rounded-xl bg-slate-50/20 flex flex-col justify-between hover:border-teal-500/30 transition-all">
                  <div className="w-full">
                    <div className="h-28 overflow-hidden rounded bg-slate-100 relative group">
                      <ImagePreview src={gal.image_path} alt={gal.title} className="h-full w-full object-cover" />
                    </div>
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
                      <button type="submit" className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 flex items-center justify-center">
                        <Trash2 size={14} />
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* POPUP MODAL ADD CONTENT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-black text-slate-900">
                {activeTab === "articles" && "Tambah Artikel Baru"}
                {activeTab === "faqs" && "Tambah FAQ Baru"}
                {activeTab === "testimonials" && "Tambah Testimoni Baru"}
                {activeTab === "galleries" && "Tambah Foto Galeri Baru"}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
                disabled={isPending}
              >
                <X size={18} />
              </button>
            </div>

            {/* FORM TAMBAH KONTEN DETAIL */}
            {activeTab === "articles" && (
              <form onSubmit={(e) => handleFormSubmit(e, createArticleAction)} className="p-6 space-y-4">
                <div className="form-field">
                  <label className="form-label text-xs">Judul Artikel *</label>
                  <input className="form-input text-sm" name="title" required placeholder="Contoh: Info Pembukaan Magang Batch 5" />
                </div>
                <div className="form-field">
                  <label className="form-label text-xs">Ringkasan Artikel</label>
                  <input className="form-input text-sm" name="excerpt" placeholder="Tulis ringkasan singkat berita..." />
                </div>
                <div className="form-field">
                  <label className="form-label text-xs">Konten Isi Artikel *</label>
                  <textarea className="form-input text-xs" name="content" required rows={4} placeholder="Tulis isi berita selengkapnya..." />
                </div>
                <div className="form-field">
                  <label className="form-label text-xs">Gambar Cover Artikel</label>
                  <input type="file" name="cover" accept="image/*" className="form-input text-xs" />
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
                  <label className="form-label text-xs">Pertanyaan (Question) *</label>
                  <input className="form-input text-sm" name="question" required placeholder="Contoh: Apakah magang ini berbayar?" />
                </div>
                <div className="form-field">
                  <label className="form-label text-xs">Jawaban (Answer) *</label>
                  <textarea className="form-input text-xs" name="answer" required rows={3} placeholder="Tuliskan penjelasan jawabannya..." />
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
                  <label className="form-label text-xs">Nama Lengkap *</label>
                  <input className="form-input text-sm" name="name" required placeholder="Contoh: Andika Wijaya" />
                </div>
                <div className="form-field">
                  <label className="form-label text-xs">Keterangan / Alumni *</label>
                  <input className="form-input text-sm" name="role" required placeholder="Contoh: Alumni Magang SMK 1 Malang" />
                </div>
                <div className="form-field">
                  <label className="form-label text-xs">Kutipan Testimoni (Quote) *</label>
                  <textarea className="form-input text-xs" name="quote" required rows={3} placeholder="Tulis isi testimoni..." />
                </div>
                <div className="form-field">
                  <label className="form-label text-xs">Foto Profil</label>
                  <input type="file" name="photo" accept="image/*" className="form-input text-xs" />
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
                  <label className="form-label text-xs">Judul Foto Kegiatan *</label>
                  <input className="form-input text-sm" name="title" required placeholder="Contoh: Sesi Evaluasi Mentor Harian" />
                </div>
                <div className="form-field">
                  <label className="form-label text-xs">Deskripsi Singkat Kegiatan</label>
                  <input className="form-input text-sm" name="description" placeholder="Tulis keterangan foto..." />
                </div>
                <div className="form-field">
                  <label className="form-label text-xs">Pilih Gambar Kegiatan *</label>
                  <input type="file" name="image" accept="image/*" required className="form-input text-xs" />
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                  <button type="button" onClick={handleCloseModal} className="button-secondary text-xs h-9 min-h-0" disabled={isPending}>Batal</button>
                  <button type="submit" className="button-primary text-xs h-9 min-h-0 font-bold" disabled={isPending}>
                    {isPending ? "Memproses..." : "Upload Gambar"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
