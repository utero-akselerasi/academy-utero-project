"use client";

import { useState } from "react";
import { Upload, FileText, Trash2, Download } from "lucide-react";
import { uploadLessonAttachmentAction, deleteLessonAttachmentAction } from "../actions";

interface Attachment {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  uploaded_at: string;
}

interface LessonAttachmentsProps {
  lessonId: string;
  courseId: string;
  attachments: Attachment[];
  isEditable?: boolean;
}

export function LessonAttachments({ lessonId, courseId, attachments, isEditable = false }: LessonAttachmentsProps) {
  const [uploading, setUploading] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("lessonId", lessonId);
    formData.append("courseId", courseId);
    formData.append("file", file);

    try {
      await uploadLessonAttachmentAction(formData);
    } catch (error) {
      console.error("Error uploading:", error);
      alert("Gagal mengunggah file. Silakan coba lagi.");
    } finally {
      setUploading(false);
      e.target.value = ""; // Reset input
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm("Hapus attachment ini?")) return;

    const formData = new FormData();
    formData.append("lessonId", lessonId);
    formData.append("courseId", courseId);
    formData.append("attachmentId", attachmentId);

    try {
      await deleteLessonAttachmentAction(formData);
    } catch (error) {
      console.error("Error deleting:", error);
      alert("Gagal menghapus file.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">
          File Lampiran ({attachments.length})
        </h3>
        
        {isEditable && (
          <label className="button-secondary text-xs py-1.5 px-3 cursor-pointer flex items-center gap-1.5">
            <Upload size={14} />
            <span>{uploading ? "Uploading..." : "Upload File"}</span>
            <input
              type="file"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar"
            />
          </label>
        )}
      </div>

      {attachments.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
          Belum ada file lampiran
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                  <FileText size={20} className="text-teal-600" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {attachment.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatFileSize(attachment.size)} • {new Date(attachment.uploaded_at).toLocaleDateString("id-ID")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={attachment.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                  title="Download"
                >
                  <Download size={16} />
                </a>
                
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => handleDelete(attachment.id)}
                    className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Hapus"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
