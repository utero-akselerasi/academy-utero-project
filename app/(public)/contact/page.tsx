import { getLandingPageSettings } from "@/features/cms/queries";
﻿import { MapPin, Mail, Phone } from "lucide-react";

export default async function ContactPage() {
  const { data: dbSettings } = await getLandingPageSettings();
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=112.637%2C-7.945%2C112.647%2C-7.935&layer=mapnik&marker=-7.940%2C112.642`;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 space-y-10">
      <div 
        className="relative text-center py-16 px-8 rounded-2xl overflow-hidden shadow-md bg-cover bg-center"
        style={{ backgroundImage: "url('https://academy.uteroindonesia.com/wp-content/uploads/2024/11/wefrt-01-768x443.jpg')" }}
      >
        {/* Dark Overlay for readability */}
        <div className="absolute inset-0 bg-slate-950/70" />
        
        <div className="relative z-10 space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-red-500">Hubungi Kami</p>
          <h1 className="text-3xl md:text-4xl font-black text-white">Kontak Utero Academy</h1>
          <p className="mt-4 max-w-xl mx-auto leading-relaxed text-slate-200 text-xs md:text-sm">
            Silakan hubungi kami untuk informasi lebih lanjut mengenai program pendidikan, kerja sama, dan magang.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="surface p-5 bg-white border border-slate-200 rounded-xl space-y-2 text-center">
          <MapPin className="mx-auto text-teal-600" size={28} />
          <h3 className="font-extrabold text-sm text-slate-900">Alamat Kantor</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {dbSettings?.contact_address || "Jl. Bantaran 1 No. 25, Malang, Jawa Timur, Indonesia"}
          </p>
        </div>
        <div className="surface p-5 bg-white border border-slate-200 rounded-xl space-y-2 text-center">
          <Mail className="mx-auto text-teal-600" size={28} />
          <h3 className="font-extrabold text-sm text-slate-900">Email Hubung</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {dbSettings?.contact_email || "uteroacademy@gmail.com"}
          </p>
        </div>
        <div className="surface p-5 bg-white border border-slate-200 rounded-xl space-y-2 text-center">
          <Phone className="mx-auto text-teal-600" size={28} />
          <h3 className="font-extrabold text-sm text-slate-900">Telepon / WA</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {dbSettings?.contact_phone || "+62 895 1789 8767"}
          </p>
        </div>
      </div>

      <div className="surface overflow-hidden bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
          <h3 className="font-bold text-slate-950 text-xs">Peta Lokasi Kantor PT Utero Kreatif Indonesia</h3>
        </div>
        <iframe
          title="Utero Office Location Map"
          width="100%"
          height="350"
          frameBorder="0"
          scrolling="no"
          marginHeight={0}
          marginWidth={0}
          src={embedUrl}
          className="w-full border-none"
        />
      </div>
    </main>
  );
}
