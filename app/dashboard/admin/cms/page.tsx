import { getDefaultSite, getCmsData } from "@/features/cms/queries";
import { CmsManager } from "@/features/cms/CmsManager";
import { requireAdmin } from "@/features/auth/guards";
import { BookOpen } from "lucide-react";

export default async function AdminCmsPage() {
  // Layout dan page dirender bersamaan di App Router, jadi redirect di layout
  // tidak menghentikan pengambilan data di page ini. Guard peran harus ada di
  // page-nya sendiri: sebelumnya cukup "ada sesi", sehingga peserta atau
  // sekolah yang login bisa memuat panel CMS beserta isinya.
  await requireAdmin();

  const { data: site, error: siteErr } = await getDefaultSite();

  if (siteErr || !site) {
    const missingSite = !siteErr || (siteErr instanceof Error && siteErr.message === "site_not_found");
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="surface p-8 text-center border border-red-200 bg-red-50/50 rounded-xl">
          <BookOpen className="mx-auto text-red-500 mb-3" size={40} />
          <h2 className="text-xl font-bold text-red-950">{missingSite ? "Website CMS Belum Aktif" : "Website CMS Tidak Dapat Dimuat"}</h2>
          <p className="mt-2 text-sm text-red-700 max-w-md mx-auto leading-relaxed">
            {missingSite
              ? "Situs web default Utero Academy belum diinisialisasi di database. Jalankan migrasi database backend untuk membuat site."
              : "Gagal terhubung ke layanan CMS. Periksa koneksi backend dan log server."}
          </p>
        </div>
      </main>
    );
  }

  const cmsData = await getCmsData(site.id, { includeDrafts: true });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase text-teal-700">Admin Control Panel</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Website CMS Manager</h1>
        <p className="mt-2 max-w-2xl leading-7 text-slate-600">
          Kelola konten publik situs web Utero Academy: terbitkan artikel blog/berita, FAQ, testimoni, dan galeri foto.
        </p>
      </div>

      <CmsManager 
        site={site} 
        faqs={cmsData.faqs}
        testimonials={cmsData.testimonials}
        galleries={cmsData.galleries}
        articles={cmsData.articles}
      />
    </main>
  );
}
