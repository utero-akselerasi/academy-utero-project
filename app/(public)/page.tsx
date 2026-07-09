import { getCmsData } from "@/features/cms/queries";
import { type Faq, type Testimonial, type Gallery, type Article } from "@/features/cms/types";
import { 
  ArrowRight, BookOpen, ClipboardCheck, GraduationCap, 
  Newspaper, HelpCircle, Heart, Star, Award, 
  Facebook, Twitter, Youtube, Instagram, Quote 
} from "lucide-react";
import Link from "next/link";

// 10 Skills Competency matching the design
const skills = [
  { name: "Graphic Design", desc: "Desain grafis dan komunikasi visual" },
  { name: "Digital Printing", desc: "Teknik cetak digital dan produksi" },
  { name: "Branding", desc: "Strategi merek dan identitas bisnis" },
  { name: "Videography", desc: "Produksi dan editing video kreatif" },
  { name: "Social Media", desc: "Pengelolaan dan strategi konten media sosial" },
  { name: "Augmented Reality", desc: "Teknologi realitas bertambah" },
  { name: "Virtual Reality", desc: "Teknologi realitas maya" },
  { name: "Mix Reality", desc: "Teknologi realitas campuran" },
  { name: "Extended Reality", desc: "Pengembangan ekosistem XR" },
  { name: "Immersive Projection", desc: "Pemetaan proyeksi imersif" }
];

// Top Expertiser matching the design
const expertisers = [
  {
    name: "Dadik Wahyu Chang",
    role: "BRAND CONSULTANT",
    avatar: "/images/expert-dadik.jpg" // Fallback to initial if not found
  },
  {
    name: "Fitri Labuda",
    role: "HEAD OF UTERO ACADEMY",
    avatar: "/images/expert-fitri.jpg"
  },
  {
    name: "Siti Sodrianti",
    role: "PRODUCT MANAGER",
    avatar: "/images/expert-siti.jpg"
  },
  {
    name: "Wijayanty Lestari",
    role: "BRAND RESEARCH",
    avatar: "/images/expert-wijayanty.jpg"
  }
];

// Default reviews if CMS is empty or to complement it
const defaultReviews = [
  {
    name: "Pamor Prabu H.",
    school: "SMK N 1 POGALAN",
    major: "VIDEOGRAPHY",
    quote: "Sebelum mengikuti magang mengenai videografi, saya hanya bisa membuat video yang biasa-biasa saja. Tapi setelah mengikuti kelas ini, skill videografi saya meningkat pesat. Saya sekarang bisa membuat video yang lebih profesional dan menarik, dan saya bahkan sudah bisa mendapatkan penghasilan dari videografi."
  },
  {
    name: "M. Akmal Zulfi",
    school: "SMK N 1 PASURUAN",
    major: "DESIGN GRAPHIC",
    quote: "Sebelum mengikuti kegiatan magang, saya hanya mengetahui materi - materi dasar mengenai Desain Grafis, dengan membuat desain yang sederhana dan simple. Namun setelah saya mengikuti kelas ini, skill dan pengetahuan yang saya punya bertambah dan meningkat pesat. Sekarang saya bisa membuat berbagai desain yang menarik dengan konsep yang jelas, dengan memanfaatkan skill ini, saya bisa mendapatkan penghasilan sendiri melalui Desain Grafis."
  },
  {
    name: "M. Rasya Islamiyah",
    school: "SMK N 1 PASURUAN",
    major: "PHOTOGRAPHY",
    quote: "Sebelum mengikuti magang fotografi dan videografi, saya hanya bisa mendesain grafis yang membuat desain biasa-biasa saja. Tapi setelah mengikuti kelas ini, skill fotografi dan videografi saya meningkat sehingga bisa membuat video yang lebih profesional dan bisa membuat desain yang menarik."
  }
];

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const siteId = "c6e8f645-5f5e-4b33-a66a-bf92e047c212";
  let cmsData: { faqs: Faq[]; testimonials: Testimonial[]; galleries: Gallery[]; articles: Article[] } = { 
    faqs: [], testimonials: [], galleries: [], articles: [] 
  };
  
  try {
    const res = await getCmsData(siteId);
    if (res) cmsData = res;
  } catch (err) {
    console.error("Gagal memuat data CMS untuk landing page:", err);
  }

  let dbSettings = null;
  try {
    const { getLandingPageSettings } = await import("@/features/cms/queries");
    const { data } = await getLandingPageSettings();
    dbSettings = data;
  } catch (err) {
    console.error("Gagal memuat Landing Page settings:", err);
  }

  const heroTitle = dbSettings?.hero_title || "Accelerate Your Career with Academy Utero";
  const heroDescription = dbSettings?.hero_description || "Platform edukasi yang siap menciptakan desain karir on top";
  const displaySkills = dbSettings?.skills && dbSettings.skills.length > 0 ? dbSettings.skills : skills;
  const displayExpertisers = dbSettings?.expertisers && dbSettings.expertisers.length > 0 ? dbSettings.expertisers : expertisers;
  const heroImageUrl = dbSettings?.hero_image_path || null;

  const activeArticles = cmsData.articles.filter(a => a.status === "published").slice(0, 3);
  const activeFaqs = cmsData.faqs.filter(f => f.status === "published").slice(0, 4);

  // Merge CMS testimonials with our design testimonials
  const publishedTestimonials = cmsData.testimonials.filter(t => t.status === "published");
  const displayTestimonials = publishedTestimonials.length > 0 
    ? publishedTestimonials.map((t: any) => ({
        name: t.name,
        school: t.role || "Alumni Utero",
        major: "ALUMNI",
        quote: t.quote,
        photo_path: t.photo_path
      }))
    : defaultReviews;

  return (
    <main className="w-full">
      {/* 1. Hero Section */}
      <section className="bg-[#fcf8f8] py-16 px-6 md:px-12 lg:px-24">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight whitespace-pre-line">
              {heroTitle}
            </h1>
            <p className="text-slate-500 text-sm md:text-base max-w-md leading-relaxed">
              {heroDescription}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/daftar" className="button-primary px-6 py-3 font-bold text-xs flex items-center gap-2 rounded-full">
                Mulai Pendaftaran <ArrowRight size={14} />
              </Link>
              <Link href="/login" className="button-secondary px-6 py-3 font-bold text-xs bg-white border border-slate-200 rounded-full">
                Dashboard Portal
              </Link>
            </div>
          </div>
          
          {/* Hero Image Group */}
          <div className="relative flex justify-center items-center">
            {/* Circle Accent */}
            <div className="w-72 h-72 md:w-96 md:h-96 rounded-full bg-red-500 absolute -z-10 flex items-center justify-center">
              <div className="w-64 h-64 md:w-80 md:h-80 rounded-full bg-red-600"></div>
            </div>
            {/* Mock Students Avatar Illustration Container */}
            <div className="w-80 h-80 md:w-96 md:h-96 rounded-full overflow-hidden border-4 border-white shadow-xl bg-slate-100 flex items-center justify-center">
              {heroImageUrl ? (
                <img src={heroImageUrl} alt="Utero Academy Class Hero" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-6 space-y-3">
                  <GraduationCap size={48} className="text-teal-700 mx-auto" />
                  <span className="font-extrabold text-slate-800 block text-sm">UTERO ACADEMY CLASS</span>
                  <span className="text-xs text-slate-400 block max-w-[200px]">Belajar Desain, Videografi & Branding Bersama Mentor Ahli</span>
                </div>
              )}
            </div>
            {/* Floating Whatsapp Badge */}
            <a 
              href="https://wa.me/6289517898767" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="absolute bottom-4 right-4 md:right-10 bg-green-500 text-white p-3 rounded-full shadow-lg hover:bg-green-600 transition-all flex items-center justify-center"
              title="Hubungi WhatsApp"
            >
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.458L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.799-4.394 9.802-9.798.002-2.618-1.01-5.078-2.855-6.924C16.379 2.038 13.91 1.025 11.3 1.025c-5.41 0-9.809 4.398-9.812 9.802-.001 1.702.447 3.37 1.3 4.842l-.995 3.636 3.738-.98c1.427.776 2.94 1.189 4.426 1.189zM17.487 14.39c-.3-.15-1.774-.875-2.05-.975-.275-.1-.475-.15-.675.15-.2.3-.775.975-.95 1.175-.175.2-.35.225-.65.075-.3-.15-1.267-.467-2.413-1.49-.893-.797-1.496-1.782-1.67-1.982-.175-.2-.018-.308.13-.457.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5s.05-.375-.025-.525c-.075-.15-.675-1.625-.925-2.225-.244-.589-.493-.51-.675-.52-.172-.007-.37-.01-.57-.01-.2 0-.525.075-.8.375-.275.3-1.05 1.025-1.05 2.5s1.075 2.9 1.225 3.1c.15.2 2.11 3.225 5.11 4.525.714.31 1.27.495 1.7.635.718.228 1.37.196 1.885.12.57-.085 1.774-.725 2.025-1.425.25-.7.25-1.3.175-1.425-.076-.125-.276-.2-.576-.35z" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* 2. Stats Section (Dark Background) */}
      <section className="bg-[#1e293b] text-white py-12 px-6 md:px-12 lg:px-24">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 items-center">
          {/* Stat 1 */}
          <div className="flex items-center gap-4 bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 justify-center">
            <div className="text-center">
              <span className="text-3xl font-black text-white block">30+</span>
              <div className="flex justify-center gap-0.5 text-red-500 mt-1">
                <Heart size={10} fill="currentColor" />
                <Heart size={10} fill="currentColor" />
                <Heart size={10} fill="currentColor" />
                <Heart size={10} fill="currentColor" />
                <Heart size={10} fill="currentColor" />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block uppercase font-bold tracking-wider">Skill Masa Depan</span>
            </div>
          </div>
          
          {/* Stat 2 */}
          <div className="flex items-center gap-4 bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 justify-center">
            <div className="text-center">
              <span className="text-3xl font-black text-white block">4.9</span>
              <div className="flex justify-center gap-0.5 text-amber-500 mt-1">
                <Star size={10} fill="currentColor" />
                <Star size={10} fill="currentColor" />
                <Star size={10} fill="currentColor" />
                <Star size={10} fill="currentColor" />
                <Star size={10} fill="currentColor" />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block uppercase font-bold tracking-wider">Kepuasan Alumni</span>
            </div>
          </div>

          {/* Stat 3 */}
          <div className="space-y-4">
            <p className="text-xs text-red-500 font-extrabold uppercase tracking-widest">OUR ACHIEVEMENT</p>
            <h3 className="text-2xl font-black leading-tight text-white">
              10,000+ alumni punya <br />
              <span className="italic font-bold text-slate-300">Top Career</span>
            </h3>
            
            {/* Partnerships */}
            <div className="pt-2 border-t border-slate-700">
              <p className="text-[9px] text-slate-500 uppercase tracking-widest font-extrabold mb-2">PARTNERSHIP</p>
              <div className="flex flex-wrap gap-3 items-center opacity-75">
                {dbSettings?.partnerships && dbSettings.partnerships.length > 0 ? (
                  dbSettings.partnerships.map((partner: any, idx: number) => (
                    partner.logo_url ? (
                      <img key={idx} src={partner.logo_url} alt={partner.name} className="h-10 w-auto object-contain max-w-[150px] border border-slate-700/30 p-1 rounded bg-white/10" title={partner.name} />
                    ) : (
                      <span key={idx} className="text-[10px] font-black tracking-wider text-slate-400 border border-slate-700 px-2 py-0.5 rounded">
                        {partner.name}
                      </span>
                    )
                  ))
                ) : (
                  ["YAMAHA", "COCA-COLA", "PERCETAKAN", "DESAIN STU", "UTERO"].map((partner, idx) => (
                    <span key={idx} className="text-[10px] font-black tracking-wider text-slate-400 border border-slate-700 px-2 py-0.5 rounded">
                      {partner}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Skills Competency Section */}
      <section className="py-20 px-6 md:px-12 lg:px-24 bg-white">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-black text-slate-900">Skills Competency</h2>
            <div className="w-12 h-1 bg-red-600 mx-auto"></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {displaySkills.map((skill: any, idx: number) => {
              const cardContent = (
                <>
                  <div className="w-12 h-12 rounded-full border border-red-500 text-red-500 flex items-center justify-center font-bold mb-4 bg-red-50 overflow-hidden shrink-0 group-hover:bg-red-500 group-hover:text-white transition-all">
                    {skill.icon_url ? (
                      <img src={skill.icon_url} alt={skill.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  <h4 className="text-xs font-black text-slate-800 tracking-wide mb-3">{skill.name}</h4>
                  <span className="text-[10px] text-red-500 font-extrabold uppercase tracking-wider group-hover:underline">
                    LEARN MORE ?
                  </span>
                </>
              );

              if (skill.link) {
                return (
                  <a
                    key={idx}
                    href={skill.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-red-500 hover:shadow-md transition-all flex flex-col justify-between items-center group cursor-pointer block"
                  >
                    {cardContent}
                  </a>
                );
              }

              return (
                <div 
                  key={idx} 
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-red-500 hover:shadow-md transition-all flex flex-col justify-between items-center group cursor-pointer"
                >
                  {cardContent}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Top Expertiser Section */}
      <section className="py-20 px-6 md:px-12 lg:px-24 bg-[#f8fafc] border-t border-slate-200">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <p className="text-xs text-red-500 font-extrabold uppercase tracking-widest">OUR TEAM</p>
            <h2 className="text-3xl font-black text-slate-900">Top Expertiser</h2>
            <div className="w-12 h-1 bg-red-600 mx-auto"></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {displayExpertisers.map((exp: any, idx: number) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div className="w-full h-48 bg-slate-200 flex items-center justify-center text-slate-400 relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
                  <span className="font-extrabold text-white text-3xl uppercase z-10">
                    {exp.name.split(" ").map((w: string) => w[0]).join("")}
                  </span>
                </div>
                <div className="p-4 text-center space-y-2">
                  <span className="text-[9px] font-black text-red-600 tracking-wider uppercase block">{exp.role}</span>
                  <h4 className="text-sm font-black text-slate-850 truncate">{exp.name}</h4>
                  
                  {/* Social Media icons */}
                  <div className="flex justify-center gap-2 text-slate-400 pt-1">
                    <Facebook size={12} className="hover:text-teal-700 cursor-pointer" />
                    <Twitter size={12} className="hover:text-teal-700 cursor-pointer" />
                    <Youtube size={12} className="hover:text-teal-700 cursor-pointer" />
                    <Instagram size={12} className="hover:text-teal-700 cursor-pointer" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center pt-4">
            <button className="button-secondary px-6 py-2.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-full">
              MORE MEMBERS
            </button>
          </div>
        </div>
      </section>

      {/* 5. Top Skill Review Section (Dark Background) */}
      <section className="py-20 px-6 md:px-12 lg:px-24 bg-[#1e293b] text-white">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-black text-white">Top Skill Review</h2>
            <div className="w-12 h-1 bg-red-600 mx-auto"></div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {displayTestimonials.slice(0, 3).map((review, idx) => (
              <div 
                key={idx} 
                className="bg-slate-800/80 border border-slate-700 rounded-3xl p-6 flex flex-col justify-between space-y-6 relative hover:scale-[1.02] transition-all shadow-lg"
              >
                <div className="absolute top-6 left-6 text-slate-700 opacity-20">
                  <Quote size={48} fill="currentColor" />
                </div>
                
                <p className="text-xs text-slate-300 leading-relaxed italic z-10 pt-4">
                  "{review.quote}"
                </p>

                <div className="flex flex-col items-center pt-4 border-t border-slate-700 shrink-0 text-center">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-red-600 text-white flex items-center justify-center font-black uppercase text-sm mb-3 border border-slate-700/50">
                    {(review as any).photo_path ? (
                      <img src={(review as any).photo_path} alt={review.name} className="h-full w-full object-cover" />
                    ) : (
                      review.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <h5 className="font-black text-white text-xs block">{review.name}</h5>
                    <span className="text-[10px] text-slate-400 block font-bold mt-0.5">{review.school}</span>
                    <span className="text-[9px] text-red-500 font-extrabold uppercase block tracking-wider mt-1">{review.major}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Recent Activity Section */}
      <section className="py-20 px-6 md:px-12 lg:px-24 bg-white">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="flex justify-between items-end border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs text-red-600 font-extrabold uppercase tracking-widest">OUR ACTIVITY</p>
              <h2 className="text-3xl font-black text-slate-900 mt-1">Recent activity</h2>
            </div>
            <Link href="/blog" className="text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-full flex items-center gap-1.5 transition-all">
              MORE ACTIVITY ?
            </Link>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {activeArticles.length === 0 ? (
              // Beautiful Fallback cards matching design if no CMS articles found
              <>
                <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                  <div className="w-full h-44 bg-slate-100 flex items-center justify-center text-slate-400">
                    <Newspaper size={36} />
                  </div>
                  <div className="p-5 space-y-2">
                    <span className="text-[9px] text-red-500 font-bold uppercase block">KEGIATAN MAGANG</span>
                    <h4 className="text-sm font-black text-slate-800 leading-snug">Kunjungan Industri & Pelatihan Desain Bersama Utero Group</h4>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">Pelatihan desain grafis intensif untuk siswa SMK se-Jawa Timur.</p>
                  </div>
                  <div className="p-5 pt-0">
                    <span className="text-xs font-bold text-teal-700 hover:underline cursor-pointer">Selengkapnya ?</span>
                  </div>
                </article>
                <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                  <div className="w-full h-44 bg-slate-100 flex items-center justify-center text-slate-400">
                    <Newspaper size={36} />
                  </div>
                  <div className="p-5 space-y-2">
                    <span className="text-[9px] text-red-500 font-bold uppercase block">KEGIATAN MAGANG</span>
                    <h4 className="text-sm font-black text-slate-800 leading-snug">Uji Kompetensi Kerja (UKK) Desain & Cetak Digital</h4>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">Uji kompetensi praktis untuk menilai kelayakan kerja siswa magang.</p>
                  </div>
                  <div className="p-5 pt-0">
                    <span className="text-xs font-bold text-teal-700 hover:underline cursor-pointer">Selengkapnya ?</span>
                  </div>
                </article>
                <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                  <div className="w-full h-44 bg-slate-100 flex items-center justify-center text-slate-400">
                    <Newspaper size={36} />
                  </div>
                  <div className="p-5 space-y-2">
                    <span className="text-[9px] text-red-500 font-bold uppercase block">PRESTASI ALUMNI</span>
                    <h4 className="text-sm font-black text-slate-800 leading-snug">Kisah Sukses Alumni Magang Utero di Industri Kreatif Nasional</h4>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">Perjalanan alumni membangun portofolio hingga menembus karir top.</p>
                  </div>
                  <div className="p-5 pt-0">
                    <span className="text-xs font-bold text-teal-700 hover:underline cursor-pointer">Selengkapnya ?</span>
                  </div>
                </article>
              </>
            ) : (
              activeArticles.map((art) => (
                <article key={art.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    {art.cover_path ? (
                      <img src={art.cover_path} alt={art.title} className="w-full h-44 object-cover border-b border-slate-100" />
                    ) : (
                      <div className="w-full h-44 bg-slate-100 border-b border-slate-100 flex items-center justify-center text-slate-400">
                        <Newspaper size={36} />
                      </div>
                    )}
                    <div className="p-5 space-y-2">
                      <span className="text-[9px] text-red-500 font-bold uppercase block">ARTIKEL</span>
                      <h4 className="text-sm font-black text-slate-900 leading-snug line-clamp-2">{art.title}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{art.excerpt || "Tidak ada ringkasan."}</p>
                    </div>
                  </div>
                  <div className="p-5 pt-0">
                    <Link href={'/blog/' + art.slug} className="text-xs font-bold text-teal-700 hover:underline">
                      Selengkapnya ?
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 7. FAQ Section */}
      {activeFaqs.length > 0 && (
        <section className="py-20 px-6 md:px-12 lg:px-24 bg-[#f8fafc] border-t border-slate-200">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-2">
              <p className="text-xs text-red-500 font-extrabold uppercase tracking-widest">FAQ</p>
              <h2 className="text-3xl font-black text-slate-900">Pertanyaan yang Sering Diajukan</h2>
              <div className="w-12 h-1 bg-red-600 mx-auto"></div>
            </div>
            <div className="space-y-4">
              {activeFaqs.map((faq) => (
                <details key={faq.id} className="group border border-slate-200 rounded-2xl bg-white p-5 shadow-sm transition-all [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex items-center justify-between cursor-pointer focus:outline-none">
                    <h3 className="text-xs md:text-sm font-black text-slate-900 flex items-center gap-2">
                      <HelpCircle size={16} className="text-teal-700" />
                      <span>{faq.question}</span>
                    </h3>
                    <span className="transition duration-300 group-open:-rotate-180 text-xs text-slate-400">
                      ?
                    </span>
                  </summary>
                  <p className="mt-3 text-xs leading-relaxed text-slate-600 border-t border-slate-100 pt-3">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
