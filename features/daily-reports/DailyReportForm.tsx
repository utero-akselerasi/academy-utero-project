"use client";

import { submitDailyReportAction, type DailyReportFormState } from "@/features/daily-reports/actions";
import { useActionState, useState, useRef, useEffect } from "react";
import { Paperclip, X, AlertTriangle, Link as LinkIcon } from "lucide-react";
import Link from "next/link";

const initialState = {
  ok: false,
  message: "",
};

type Props = {
  editReport?: {
    id: string;
    report_date: string;
    today_work: string;
    progress: string | null;
    blockers: string | null;
    tomorrow_plan: string | null;
    daily_report_attachments?: { id: string; file_path: string; file_name: string }[];
  };
};

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function DailyReportForm({ editReport }: Props) {
  const [state, formAction, isPending] = useActionState(submitDailyReportAction, initialState);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [driveLink, setDriveLink] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load link google drive lama jika ada
  useEffect(() => {
    if (editReport?.daily_report_attachments) {
      const driveAtt = editReport.daily_report_attachments.find(att => att.file_path.includes("google.com") || att.file_path.includes("drive.google.com"));
      if (driveAtt) {
        setDriveLink(driveAtt.file_path);
      }
    } else {
      setDriveLink("");
    }
    // Reset file terpilih saat berganti mode
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [editReport]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
    }
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const hasOversizedFile = false;

  const driveLinkRequired = hasOversizedFile;
  const isDriveLinkValid = !driveLink || driveLink.includes("google.com") || driveLink.includes("drive.google.com");
  
  const canSubmit = !hasOversizedFile || (driveLink && isDriveLinkValid);

  return (
    <form action={formAction} className="surface grid gap-5 p-6 bg-white">
      {editReport ? (
        <div className="bg-teal-50 border border-teal-200 text-teal-800 p-3 rounded-lg flex items-center justify-between text-xs">
          <span>Mode: <strong>Mengedit/Merevisi Laporan</strong> ({editReport.report_date})</span>
          <Link href="/dashboard/intern/daily-reports" className="font-bold underline hover:text-teal-950">
            Batal
          </Link>
        </div>
      ) : null}

      {editReport ? (
        <input type="hidden" name="reportId" value={editReport.id} />
      ) : null}

      <div className="form-field">
        <label className="form-label" htmlFor="reportDate">
          Tanggal Laporan
        </label>
        <input
          className="form-input read-only:bg-slate-100"
          defaultValue={editReport ? editReport.report_date : getTodayDate()}
          id="reportDate"
          name="reportDate"
          required
          type="date"
          readOnly={!!editReport}
        />
      </div>
      
      <div className="form-field">
        <label className="form-label" htmlFor="todayWork">
          Pekerjaan Hari Ini *
        </label>
        <textarea
          className="form-input"
          defaultValue={editReport ? editReport.today_work : ""}
          id="todayWork"
          name="todayWork"
          placeholder="Jelaskan pekerjaan yang dilakukan hari ini..."
          required
          rows={4}
          key={editReport ? editReport.id + "-work" : "new-work"}
        />
      </div>
      
      <div className="form-field">
        <label className="form-label" htmlFor="progress">
          Progress
        </label>
        <textarea
          className="form-input"
          defaultValue={editReport ? (editReport.progress || "") : ""}
          id="progress"
          name="progress"
          placeholder="Sejauh mana progress pekerjaan..."
          rows={2}
          key={editReport ? editReport.id + "-progress" : "new-progress"}
        />
      </div>
      
      <div className="form-field">
        <label className="form-label" htmlFor="blockers">
          Kendala
        </label>
        <textarea
          className="form-input"
          defaultValue={editReport ? (editReport.blockers || "") : ""}
          id="blockers"
          name="blockers"
          placeholder="Kendala yang dihadapi (kosongkan jika tidak ada)..."
          rows={2}
          key={editReport ? editReport.id + "-blockers" : "new-blockers"}
        />
      </div>
      
      <div className="form-field">
        <label className="form-label" htmlFor="tomorrowPlan">
          Rencana Besok
        </label>
        <textarea
          className="form-input"
          defaultValue={editReport ? (editReport.tomorrow_plan || "") : ""}
          id="tomorrowPlan"
          name="tomorrowPlan"
          placeholder="Rencana pekerjaan untuk besok..."
          rows={2}
          key={editReport ? editReport.id + "-tomorrow" : "new-tomorrow"}
        />
      </div>

      <div className="form-field">
        <label className="form-label">
          File Lampiran (Bisa pilih banyak)
        </label>
        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg p-3 cursor-pointer hover:border-teal-500 bg-slate-50">
          <Paperclip size={18} className="text-slate-500" />
          <span className="text-sm text-slate-700 font-bold">Pilih file...</span>
          <input
            id="attachment"
            name="attachment"
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            multiple
            onChange={handleFileChange}
            ref={fileInputRef}
          />
        </label>

        {editReport?.daily_report_attachments && editReport.daily_report_attachments.length > 0 ? (
          <div className="mt-2 text-xs text-slate-500 p-2 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="font-bold block mb-1">Lampiran saat ini:</span>
            <ul className="list-disc list-inside space-y-1">
              {editReport.daily_report_attachments.map((att) => (
                <li key={att.id} className="truncate text-teal-700">
                  ?? {att.file_name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {selectedFiles.length > 0 && (
          <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">File terpilih ({selectedFiles.length}):</span>
              <button
                type="button"
                onClick={clearFiles}
                className="text-xs text-red-600 font-bold hover:underline flex items-center gap-1"
              >
                <X size={12} /> Hapus semua
              </button>
            </div>
            <ul className="text-xs text-slate-600 grid gap-1">
              {selectedFiles.map((file, idx) => {
                return (
                  <li key={idx} className="flex justify-between items-center gap-2">
                    <span className="truncate">
                      📄 {file.name}
                    </span>
                    <span className="shrink-0 text-slate-400">
                      {formatBytes(file.size)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="googleDriveLink">
          Link Google Drive {driveLinkRequired ? <span className="text-red-600 font-bold">*</span> : null}
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <LinkIcon size={16} className="text-slate-400" />
          </div>
          <input
            className={"form-input !pl-10 " + (driveLinkRequired && !driveLink ? "border-red-300 bg-red-50" : "")}
            id="googleDriveLink"
            name="googleDriveLink"
            type="url"
            value={driveLink}
            onChange={(e) => setDriveLink(e.target.value)}
            placeholder="https://drive.google.com/..."
            required={driveLinkRequired}
          />
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Gunakan kolom ini jika melampirkan link dari Google Drive.
        </p>
        {driveLink && !isDriveLinkValid ? (
          <p className="text-xs text-red-600 mt-1 font-semibold">
            Link harus mengandung drive.google.com atau google.com
          </p>
        ) : null}
      </div>



      {state.message ? (
        <p className={"text-sm font-semibold " + (state.ok ? "text-teal-700" : "text-red-700")}>
          {state.message}
        </p>
      ) : null}
      <button
        className="button-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isPending || !canSubmit}
        type="submit"
      >
        {isPending ? "Mengirim..." : (editReport ? "Simpan Perubahan" : "Kirim Laporan")}
      </button>
    </form>
  );
}
