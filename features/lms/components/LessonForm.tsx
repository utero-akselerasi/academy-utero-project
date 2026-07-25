"use client";

import { useState } from "react";
import { RichTextEditor } from "./RichTextEditor";
import { Save, X } from "lucide-react";

interface LessonFormProps {
  courseId: string;
  lesson?: {
    id: string;
    title: string;
    content: string;
    video_url: string | null;
  };
  onClose?: () => void;
}

export function LessonForm({ courseId, lesson, onClose }: LessonFormProps) {
  const [title, setTitle] = useState(lesson?.title || "");
  const [content, setContent] = useState(lesson?.content || "");
  const [videoUrl, setVideoUrl] = useState(lesson?.video_url || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    formData.set("content", content); // Set dari rich text editor state

    try {
      const response = await fetch("/api/lms/lessons", {
        method: lesson ? "PUT" : "POST",
        body: formData
      });

      if (!response.ok) throw new Error("Gagal menyimpan lesson");

      if (onClose) onClose();
      window.location.reload();
    } catch (error) {
      console.error("Error:", error);
      alert("Gagal menyimpan materi. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="courseId" value={courseId} />
      {lesson && <input type="hidden" name="lessonId" value={lesson.id} />}

      <div className="form-field">
        <label className="form-label" htmlFor="title">
          Judul Materi *
        </label>
        <input
          type="text"
          id="title"
          name="title"
          className="form-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Contoh: Pengenalan React Hooks"
        />
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="videoUrl">
          URL Video (Opsional)
        </label>
        <input
          type="url"
          id="videoUrl"
          name="videoUrl"
          className="form-input"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
        />
        <p className="text-xs text-slate-500 mt-1">
          Masukkan URL video YouTube, Vimeo, atau platform lain
        </p>
      </div>

      <div className="form-field">
        <label className="form-label">
          Konten Materi *
        </label>
        <RichTextEditor
          content={content}
          onChange={setContent}
          placeholder="Tulis konten materi pembelajaran di sini..."
        />
        <p className="text-xs text-slate-500 mt-1">
          Gunakan toolbar untuk format text, tambah link, gambar, dan list
        </p>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
        <button
          type="submit"
          disabled={isSubmitting}
          className="button-primary flex items-center gap-2"
        >
          <Save size={16} />
          <span>{isSubmitting ? "Menyimpan..." : lesson ? "Update Materi" : "Buat Materi"}</span>
        </button>
        
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="button-secondary flex items-center gap-2"
          >
            <X size={16} />
            <span>Batal</span>
          </button>
        )}
      </div>
    </form>
  );
}
