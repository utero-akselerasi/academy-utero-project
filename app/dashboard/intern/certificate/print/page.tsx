import { getInternCertificate } from "@/features/assessments/queries";
import { getInternProfileId } from "@/features/daily-reports/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Award, GraduationCap } from "lucide-react";

type PageProps = {
  searchParams: Promise<{ internId?: string }>;
};

export default async function PrintCertificatePage({ searchParams }: PageProps) {
  const { internId } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let targetInternProfileId = internId;
  if (!targetInternProfileId) {
    const selfProfileId = await getInternProfileId(user.id);
    if (!selfProfileId) notFound();
    targetInternProfileId = selfProfileId;
  }

  // Ambil nama user profil dari target intern
  const { data: targetProfile } = await supabase
    .schema("utero_academy")
    .from("intern_profiles")
    .select("full_name, email")
    .eq("id", targetInternProfileId)
    .maybeSingle();

  const { data: cert, error } = await getInternCertificate(targetInternProfileId);
  const { data: settings } = await supabase
    .schema("utero_academy")
    .from("attendance_settings")
    .select("certificate_template_path")
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .maybeSingle();
  const templatePath = settings?.certificate_template_path || null;

  if (error || !cert || cert.status !== "issued") {
    notFound();
  }

  const displayName = targetProfile?.full_name || cert.certificate_number;

  return (
    <div className="bg-white min-h-screen p-8 flex flex-col items-center justify-center font-serif text-slate-800 relative select-none">
      <script dangerouslySetInnerHTML={{ __html: `window.onload = function() { window.print(); }` }} />
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          body, html {
            background: #white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-container {
            width: 297mm !important;
            height: 210mm !important;
            max-width: none !important;
            margin: 0 !important;
            border: 16px double #115e59 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background-color: #faf9f6 !important;
            padding: 3rem !important;
            box-sizing: border-box !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
          }
        }
      ` }} />

      <div 
        className={"print-container p-12 max-w-4xl w-full rounded shadow-sm text-center relative overflow-hidden my-auto aspect-[1.414/1] " + (
          templatePath 
            ? "border-0 bg-transparent" 
            : "border-[16px] border-double border-teal-800 bg-stone-50/20"
        )}
        style={templatePath ? { backgroundImage: 'url(' + templatePath + ')', backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {!templatePath && (
          <div className="absolute inset-0 opacity-[0.03] flex items-center justify-center pointer-events-none">
            <GraduationCap size={450} className="text-teal-900" />
          </div>
        )}

        {!templatePath && (
          <>
            <div className="absolute top-2 left-2 border-t-2 border-l-2 border-amber-600 h-8 w-8" />
            <div className="absolute top-2 right-2 border-t-2 border-r-2 border-amber-600 h-8 w-8" />
            <div className="absolute bottom-2 left-2 border-b-2 border-l-2 border-amber-600 h-8 w-8" />
            <div className="absolute bottom-2 right-2 border-b-2 border-r-2 border-amber-600 h-8 w-8" />
          </>
        )}

        <div className="space-y-6 relative z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="bg-teal-800 text-amber-500 p-3 rounded-full shadow-md">
              <Award size={36} />
            </div>
            <span className="text-xs font-sans font-bold tracking-widest text-teal-800 uppercase mt-2">Utero Academy Platform</span>
            <span className="text-[9px] font-sans font-bold tracking-widest text-slate-400 uppercase -mt-1.5">Sertifikat Kelulusan Resmi</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-4xl font-bold tracking-wide text-teal-900 uppercase">Sertifikat Magang</h2>
            <p className="text-xs font-sans font-bold tracking-widest text-slate-400">NOMOR: {cert.certificate_number}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs italic text-slate-500">Dengan ini menyatakan bahwa:</p>
            <h3 className="text-3xl font-black tracking-wide text-slate-900 underline decoration-amber-600 decoration-2 underline-offset-4 mt-2">
              {displayName}
            </h3>
            <p className="text-xs text-slate-500 italic mt-1">telah berhasil menyelesaikan program magang industri di Utero Academy</p>
          </div>

          <div className="max-w-xl mx-auto space-y-4">
            <p className="text-xs leading-6 text-slate-600 font-sans px-4">
              Peserta telah menempuh evaluasi penilaian kompetensi teknis, kedisiplinan, serta sikap kerja dengan hasil kelulusan yang memuaskan dan memperoleh predikat kelulusan akhir sebesar:
            </p>
            <div className="flex justify-center items-center gap-6 font-sans">
              <div className="bg-teal-50 border border-teal-200 px-6 py-2.5 rounded-lg text-center shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Nilai Akhir</span>
                <span className="text-3xl font-black text-teal-800">{cert.assessment.final_score}</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 px-6 py-2.5 rounded-lg text-center shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Predikat</span>
                <span className="text-sm font-black text-amber-800 uppercase tracking-wider">LULUS MEMUASKAN</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-10 font-sans max-w-2xl mx-auto">
            <div className="text-center space-y-1">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Pembimbing Magang</p>
              <div className="h-12 flex items-center justify-center italic text-teal-800 font-serif text-sm font-bold">
                Signed by UA
              </div>
              <div className="w-32 h-px bg-slate-300 mx-auto" />
              <p className="text-[10px] text-slate-800 font-bold uppercase mt-1">Utero Academy Team</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Direktur Utero Group</p>
              <div className="h-12 flex items-center justify-center italic text-teal-800 font-serif text-sm font-bold">
                Dwi Fajar Budiman
              </div>
              <div className="w-32 h-px bg-slate-300 mx-auto" />
              <p className="text-[10px] text-slate-800 font-bold uppercase mt-1">Director</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
