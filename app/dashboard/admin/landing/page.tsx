import { getLandingPageSettings } from "@/features/cms/queries";
import { LandingPageEditor } from "@/features/cms/LandingPageEditor";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";

export default async function AdminLandingCmsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: landingSettings, error } = await getLandingPageSettings();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="mb-4">
        <p className="text-sm font-bold uppercase text-teal-700">Admin Control Panel</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950 flex items-center gap-2">
          <LayoutDashboard className="text-teal-700" size={30} />
          <span>Landing Page Editor</span>
        </h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-slate-650 text-sm">
          Kelola konten halaman utama (Landing Page) Utero Academy secara visual: judul, deskripsi banner, kompetensi keahlian, mitra kerja, serta legalitas.
        </p>
      </div>

      {error ? (
        <div className="surface p-4 text-sm font-semibold text-red-750 mb-6 bg-red-50 border border-red-200 rounded-xl">
          Gagal memuat pengaturan Landing Page. Pastikan migrasi database SQL 0009 & 0010 sudah dijalankan.
        </div>
      ) : null}

      <LandingPageEditor landingSettings={landingSettings || undefined} />
    </main>
  );
}
