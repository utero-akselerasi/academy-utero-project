"use client";
import { Upload } from "lucide-react";

export function UploadTemplateButton() {
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-650 font-bold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 cursor-pointer hover:border-teal-500 hover:text-teal-700 w-full md:w-auto justify-center">
      <Upload size={14} />
      <span>Pilih Template</span>
      <input 
        name="templateFile" 
        type="file" 
        accept="image/*" 
        required 
        className="hidden" 
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            e.target.form?.requestSubmit();
          }
        }} 
      />
    </label>
  );
}
