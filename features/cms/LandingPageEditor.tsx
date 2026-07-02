"use client";

import { useState } from "react";
import { updateLandingPageSettingsAction, uploadCmsFileAction } from "@/features/cms/actions";
import { type LandingPageSettings } from "./types";
import { 
  Save, Upload, ArrowUp, ArrowDown, Plus, Trash2, HelpCircle 
} from "lucide-react";

type Props = {
  landingSettings?: LandingPageSettings;
};

export function LandingPageEditor({ landingSettings }: Props) {
  const [landingSubTab, setLandingSubTab] = useState<"hero" | "skills" | "experts" | "partners" | "pages">("hero");
  const [skillsList, setSkillsList] = useState<any[]>(landingSettings?.skills || []);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [expertsList, setExpertsList] = useState<any[]>(landingSettings?.expertisers || []);
  const [heroImageUrl, setHeroImageUrl] = useState<string>(landingSettings?.hero_image_path || "");
  const [partnershipsList, setPartnershipsList] = useState<any[]>(landingSettings?.partnerships || []);
  const [uploadingPartnerIndex, setUploadingPartnerIndex] = useState<number | null>(null);
  const [uploadingSkillIndex, setUploadingSkillIndex] = useState<number | null>(null);

  // File Upload Helpers
  const handleFileUpload = async (index: number, file: File) => {
    if (!file) return;
    setUploadingIndex(index);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const url = await uploadCmsFileAction(formData);
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
      const url = await uploadCmsFileAction(formData);
      setHeroImageUrl(url);
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
      const url = await uploadCmsFileAction(formData);
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
      const url = await uploadCmsFileAction(formData);
      updateSkill(index, "icon_url", url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengunggah icon.");
    } finally {
      setUploadingSkillIndex(null);
    }
  };

  const [isHeroUploading, setIsHeroUploading] = useState(false);

  // Skills Helpers
  const moveSkill = (index: number, direction: "up" | "down") => {
    const updated = [...skillsList];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setSkillsList(updated);
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
      {/* Sub-tabs untuk memecah form JSON */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-3">
        {[
          { label: "Hero Banner", value: "hero" },
          { label: "Skills Competencies", value: "skills" },
          { label: "Top Expertisers", value: "experts" },
          { label: "Partnership Logos", value: "partners" },
          { label: "About, Kontak, & Syarat", value: "pages" }
        ].map(sub => (
          <button
            key={sub.value}
            type="button"
            onClick={() => setLandingSubTab(sub.value as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              landingSubTab === sub.value 
                ? "bg-teal-50 text-teal-800 border border-teal-200" 
                : "text-slate-500 hover:text-slate-900 bg-slate-50 border border-transparent"
            }`}
          >
            {sub.label}
          </button>
        ))}
      </div>

      <form action={updateLandingPageSettingsAction} className="space-y-6 max-w-3xl">
        {/* Hidden Inputs untuk visual builder state */}
        <input type="hidden" name="skillsJson" value={JSON.stringify(skillsList)} />
        <input type="hidden" name="expertisersJson" value={JSON.stringify(expertsList)} />
        <input type="hidden" name="heroImageUrl" value={heroImageUrl} />
        <input type="hidden" name="partnershipsJson" value={JSON.stringify(partnershipsList)} />

        {/* Sub-tab 1: Hero */}
        <div className={landingSubTab === "hero" ? "space-y-4 animate-in fade-in duration-200" : "hidden"}>
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

          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700">Hero Image / Banner *</label>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
              {heroImageUrl ? (
                <div className="h-20 w-32 overflow-hidden rounded border border-slate-350 bg-slate-100 shrink-0">
                  <img src={heroImageUrl} alt="Hero Banner" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="h-20 w-32 rounded border border-slate-300 bg-slate-100 flex items-center justify-center shrink-0 text-slate-400 text-xs font-bold">
                  No Image
                </div>
              )}
              <div className="space-y-2">
                <label className="button-secondary text-xs h-9 py-0 px-3 min-h-0 flex items-center justify-center shrink-0 cursor-pointer bg-white border border-slate-200 hover:border-teal-500 hover:text-teal-700 font-bold">
                  <Upload size={14} className="mr-1.5" />
                  <span>{isHeroUploading ? "Mengunggah..." : "Unggah Foto Baru"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={isHeroUploading}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleHeroUpload(e.target.files[0]);
                      }
                    }}
                  />
                </label>
                <p className="text-[10px] text-slate-400">File format: JPG, PNG, WEBP. Rekomendasi rasio landscape.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-tab 2: Skills (Visual Builder) */}
        <div className={landingSubTab === "skills" ? "space-y-4 animate-in fade-in duration-200" : "hidden"}>
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Daftar Skills Competencies</h4>
              <p className="text-[10px] text-slate-400">Susun dan urutkan keahlian yang diajarkan di Utero Academy.</p>
            </div>
            <button
              type="button"
              onClick={addSkill}
              className="button-secondary text-[10px] py-1 px-2.5 min-h-0 flex items-center gap-1 font-bold border-teal-200 text-teal-800 hover:bg-teal-50"
            >
              <Plus size={12} />
              <span>Tambah Keahlian</span>
            </button>
          </div>

          <div className="grid gap-3">
            {skillsList.map((skill, index) => (
              <div key={index} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-between gap-4">
                <div className="grid gap-2 flex-1 sm:grid-cols-2 lg:grid-cols-4">
                  <input
                    className="form-input text-xs bg-white"
                    placeholder="Nama Keahlian (misal: Graphic Design)"
                    value={skill.name}
                    onChange={(e) => updateSkill(index, "name", e.target.value)}
                    required
                  />
                  <input
                    className="form-input text-xs bg-white"
                    placeholder="Deskripsi singkat keahlian..."
                    value={skill.desc}
                    onChange={(e) => updateSkill(index, "desc", e.target.value)}
                    required
                  />
                  <input
                    className="form-input text-xs bg-white"
                    placeholder="Link Tautan Keahlian (opsional)"
                    value={skill.link || ""}
                    onChange={(e) => updateSkill(index, "link", e.target.value)}
                  />
                  <div className="flex gap-1.5 items-center">
                    <input
                      className="form-input text-xs bg-white flex-1 min-w-0"
                      placeholder="URL Icon (opsional jika upload)"
                      value={skill.icon_url || ""}
                      onChange={(e) => updateSkill(index, "icon_url", e.target.value)}
                    />
                    <label className="button-secondary text-xs h-9 py-0 px-2 min-h-0 flex items-center justify-center shrink-0 cursor-pointer bg-white border border-slate-200 hover:border-teal-500 hover:text-teal-700" title="Unggah Icon Baru">
                      {uploadingSkillIndex === index ? (
                        <span className="text-[9px] font-semibold text-slate-400">Loading...</span>
                      ) : (
                        <Upload size={14} />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingSkillIndex !== null}
                        onChange={(e) => {
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
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveSkill(index, "up")}
                    className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30"
                    title="Pindah Ke Atas"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={index === skillsList.length - 1}
                    onClick={() => moveSkill(index, "down")}
                    className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30"
                    title="Pindah Ke Bawah"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSkill(index)}
                    className="p-1.5 rounded hover:bg-red-50 text-red-500 border border-transparent hover:border-red-200"
                    title="Hapus Keahlian"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-tab 3: Experts (Visual Builder) */}
        <div className={landingSubTab === "experts" ? "space-y-4 animate-in fade-in duration-200" : "hidden"}>
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Daftar Tim Expert / Mentor</h4>
              <p className="text-[10px] text-slate-400">Susun dan urutkan expert yang muncul di landing page.</p>
            </div>
            <button
              type="button"
              onClick={addExpert}
              className="button-secondary text-[10px] py-1 px-2.5 min-h-0 flex items-center gap-1.5 font-bold border-teal-200 text-teal-800 hover:bg-teal-50"
            >
              <Plus size={12} />
              <span>Tambah Expert</span>
            </button>
          </div>

          <div className="grid gap-3">
            {expertsList.map((exp, index) => (
              <div key={index} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-between gap-4">
                <div className="grid gap-2 flex-1 sm:grid-cols-3">
                  <input
                    className="form-input text-xs bg-white"
                    placeholder="Nama Mentor"
                    value={exp.name}
                    onChange={(e) => updateExpert(index, "name", e.target.value)}
                    required
                  />
                  <input
                    className="form-input text-xs bg-white"
                    placeholder="Jabatan/Role (misal: BRAND CONSULTANT)"
                    value={exp.role}
                    onChange={(e) => updateExpert(index, "role", e.target.value)}
                    required
                  />
                  <div className="flex gap-1.5 items-center">
                    <input
                      className="form-input text-xs bg-white flex-1 min-w-0"
                      placeholder="Path Foto (misal: /images/expert-dadik.jpg)"
                      value={exp.avatar}
                      onChange={(e) => updateExpert(index, "avatar", e.target.value)}
                      required
                    />
                    <label className="button-secondary text-xs h-9 py-0 px-2 min-h-0 flex items-center justify-center shrink-0 cursor-pointer bg-white border border-slate-200 hover:border-teal-500 hover:text-teal-700" title="Unggah Foto Baru">
                      {uploadingIndex === index ? (
                        <span className="text-[9px] font-semibold text-slate-400">Loading...</span>
                      ) : (
                        <Upload size={14} />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingIndex !== null}
                        onChange={(e) => {
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
                    disabled={index === 0}
                    onClick={() => moveExpert(index, "up")}
                    className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30"
                    title="Pindah Ke Atas"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={index === expertsList.length - 1}
                    onClick={() => moveExpert(index, "down")}
                    className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30"
                    title="Pindah Ke Bawah"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeExpert(index)}
                    className="p-1.5 rounded hover:bg-red-50 text-red-500 border border-transparent hover:border-red-200"
                    title="Hapus Expert"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-tab 3.5: Partnerships Logos */}
        <div className={landingSubTab === "partners" ? "space-y-4 animate-in fade-in duration-200" : "hidden"}>
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Logo Partner & Kerjasama</h4>
              <p className="text-[10px] text-slate-400">Susun dan unggah logo partner / sponsor Utero Academy.</p>
            </div>
            <button
              type="button"
              onClick={addPartner}
              className="button-secondary text-[10px] py-1 px-2.5 min-h-0 flex items-center gap-1.5 font-bold border-teal-200 text-teal-800 hover:bg-teal-50"
            >
              <Plus size={12} />
              <span>Tambah Partner</span>
            </button>
          </div>

          <div className="grid gap-3">
            {partnershipsList.map((partner, index) => (
              <div key={index} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-between gap-4">
                <div className="grid gap-2 flex-1 sm:grid-cols-2">
                  <input
                    className="form-input text-xs bg-white animate-none"
                    placeholder="Nama Partner (misal: YAMAHA)"
                    value={partner.name}
                    onChange={(e) => updatePartner(index, "name", e.target.value)}
                    required
                  />
                  <div className="flex gap-1.5 items-center">
                    <input
                      className="form-input text-xs bg-white flex-1 min-w-0"
                      placeholder="URL Logo (opsional jika upload)"
                      value={partner.logo_url}
                      onChange={(e) => updatePartner(index, "logo_url", e.target.value)}
                    />
                    <label className="button-secondary text-xs h-9 py-0 px-2 min-h-0 flex items-center justify-center shrink-0 cursor-pointer bg-white border border-slate-200 hover:border-teal-500 hover:text-teal-700" title="Unggah Logo Partner">
                      {uploadingPartnerIndex === index ? (
                        <span className="text-[9px] font-semibold text-slate-400">Loading...</span>
                      ) : (
                        <Upload size={14} />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingPartnerIndex !== null}
                        onChange={(e) => {
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
                    disabled={index === 0}
                    onClick={() => movePartner(index, "up")}
                    className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30"
                    title="Pindah Ke Atas"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={index === partnershipsList.length - 1}
                    onClick={() => movePartner(index, "down")}
                    className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30"
                    title="Pindah Ke Bawah"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePartner(index)}
                    className="p-1.5 rounded hover:bg-red-50 text-red-500 border border-transparent hover:border-red-200"
                    title="Hapus Partner"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-tab 4: Halaman Lain (About, Kontak, T&C) */}
        <div className={landingSubTab === "pages" ? "space-y-4 animate-in fade-in duration-200" : "hidden"}>
          {/* Tentang Kami / About Us */}
          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700" htmlFor="aboutText">Tentang Kami (About Us Text)</label>
            <p className="text-[10px] text-slate-400 mb-1">Teks profil/sejarah lembaga. Akan ditampilkan secara dinamis di halaman publik <strong>"/about"</strong>.</p>
            <textarea 
              className="form-input text-sm min-h-[80px]" 
              id="aboutText" 
              name="aboutText" 
              defaultValue={landingSettings?.about_text || ""} 
            />
          </div>

          {/* Kontak & Alamat */}
          <p className="text-[10px] text-slate-400">Informasi kontak & peta instansi. Akan ditampilkan secara dinamis di halaman publik <strong>"/contact"</strong>.</p>
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

          {/* Syarat & Ketentuan / Terms */}
          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700" htmlFor="termsContent">Syarat & Ketentuan (Terms & Conditions)</label>
            <p className="text-[10px] text-slate-400 mb-1">Dokumen tata tertib & legalitas magang. Akan ditampilkan secara dinamis di halaman publik <strong>"/terms"</strong>.</p>
            <textarea 
              className="form-input text-sm min-h-[80px]" 
              id="termsContent" 
              name="termsContent" 
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
            <Save size={16} />
            <span>Simpan Pengaturan</span>
          </button>
        </div>
      </form>
    </div>
  );
}
