import { getDefaultSite, getCmsData } from "@/features/cms/queries";
import { CmsManager } from "@/features/cms/CmsManager";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";

export default async function AdminCmsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: site, error: siteErr } = await getDefaultSite();

  if (siteErr || !site) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="surface p-8 text-center border border-red-200 bg-red-50/50 rounded-xl">
          <BookOpen className="mx-auto text-red-500 mb-3" size={40} />
          <h2 className="text-xl font-bold text-red-950">Website CMS Belum Aktif</h2>
          <p className="mt-2 text-sm text-red-700 max-w-md mx-auto leading-relaxed">
            Situs web default Utero Academy belum diinisialisasi di database. Jalankan DDL SQL untuk membuat site.
          </p>
        </div>
      </main>
    );
  }

  const cmsData = await getCmsData(site.id);

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
