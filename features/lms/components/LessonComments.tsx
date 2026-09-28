"use client";

import { useState } from "react";
import { MessageCircle, Reply, Pin, Trash2, Send } from "lucide-react";
import { createCommentAction, replyCommentAction, pinCommentAction, deleteCommentAction } from "../actions";

interface Comment {
  id: string;
  lesson_id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  is_pinned: boolean;
  created_at: string;
  user_name: string;
  user_role: string;
  replies?: Comment[];
}

interface LessonCommentsProps {
  lessonId: string;
  courseId: string;
  comments: Comment[];
  currentUserId: string;
  currentUserRole: string;
}

export function LessonComments({ 
  lessonId, 
  courseId, 
  comments, 
  currentUserId, 
  currentUserRole 
}: LessonCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // `admin` adalah administrator sekaligus pembimbing; `mentor` bukan lagi peran
  // login (migrasi 0028). `currentUserRole` bertipe string biasa, jadi tsc tidak
  // menjaga nilainya di sini — jangan tambahkan kembali "mentor".
  const isMentorOrAdmin = ["admin", "super_admin"].includes(currentUserRole);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("lessonId", lessonId);
    formData.append("courseId", courseId);
    formData.append("content", newComment);

    try {
      await createCommentAction(formData);
      setNewComment("");
    } catch (error) {
      console.error("Error:", error);
      alert("Gagal mengirim komentar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (commentId: string) => {
    if (!replyContent.trim()) return;

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("lessonId", lessonId);
    formData.append("courseId", courseId);
    formData.append("parentCommentId", commentId);
    formData.append("content", replyContent);

    try {
      await replyCommentAction(formData);
      setReplyContent("");
      setReplyingTo(null);
    } catch (error) {
      console.error("Error:", error);
      alert("Gagal mengirim balasan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePin = async (commentId: string, isPinned: boolean) => {
    const formData = new FormData();
    formData.append("commentId", commentId);
    formData.append("courseId", courseId);
    formData.append("isPinned", (!isPinned).toString());

    try {
      await pinCommentAction(formData);
    } catch (error) {
      console.error("Error:", error);
      alert("Gagal pin komentar");
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Hapus komentar ini?")) return;

    const formData = new FormData();
    formData.append("commentId", commentId);
    formData.append("courseId", courseId);

    try {
      await deleteCommentAction(formData);
    } catch (error) {
      console.error("Error:", error);
      alert("Gagal hapus komentar");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Baru saja";
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  const getRoleBadge = (role: string) => {
    if (role === "admin") {
      return <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded font-semibold">Mentor</span>;
    }
    return null;
  };

  // Organize comments: pinned first, then by date
  const pinnedComments = comments.filter(c => c.is_pinned && !c.parent_comment_id);
  const regularComments = comments.filter(c => !c.is_pinned && !c.parent_comment_id);

  const renderComment = (comment: Comment, isNested = false) => (
    <div key={comment.id} className={`${isNested ? "ml-8 mt-3" : ""}`}>
      <div className={`p-4 rounded-lg ${
        comment.is_pinned 
          ? "bg-teal-50 border-2 border-teal-200" 
          : "bg-slate-50 border border-slate-200"
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-sm text-slate-900">{comment.user_name}</span>
              {getRoleBadge(comment.user_role)}
              {comment.is_pinned && (
                <span className="flex items-center gap-1 text-xs bg-teal-600 text-white px-2 py-0.5 rounded font-semibold">
                  <Pin size={12} aria-hidden="true" />
                  Pinned
                </span>
              )}
              <span className="text-xs text-slate-400">• {formatDate(comment.created_at)}</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
          </div>

          {/*
            Ketiga tombol ini berulang di SETIAP komentar dan hanya beris ikon.
            Nama satu-satunya ada di `title`, yang tidak sampai ke pembaca layar
            maupun layar sentuh (temuan #14) — jadi dalam daftar dua puluh
            komentar, pembaca layar mengumumkan enam puluh "button" yang tak
            bisa dibedakan. `aria-label` menyebut komentar siapa yang dikenai.
          */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isNested && (
              <button
                type="button"
                onClick={() => setReplyingTo(comment.id)}
                className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                title="Balas"
                aria-label={`Balas komentar ${comment.user_name}`}
              >
                <Reply size={14} aria-hidden="true" />
              </button>
            )}

            {isMentorOrAdmin && (
              <button
                type="button"
                onClick={() => handlePin(comment.id, comment.is_pinned)}
                className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                title={comment.is_pinned ? "Unpin" : "Pin"}
                aria-label={
                  comment.is_pinned
                    ? `Lepas sematan komentar ${comment.user_name}`
                    : `Sematkan komentar ${comment.user_name}`
                }
              >
                <Pin size={14} className={comment.is_pinned ? "fill-current" : ""} aria-hidden="true" />
              </button>
            )}

            {(comment.user_id === currentUserId || isMentorOrAdmin) && (
              <button
                type="button"
                onClick={() => handleDelete(comment.id)}
                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Hapus"
                aria-label={`Hapus komentar ${comment.user_name}`}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Reply form

            Textarea-nya tanpa label (temuan #3): namanya hanya `placeholder`,
            yang hilang begitu pengguna mulai mengetik. Desainnya memang tanpa
            label terlihat, jadi labelnya `sr-only` — tetap terhubung lewat
            `htmlFor`/`id`, jadi mengkliknya tetap memindahkan fokus, dan
            id-nya diberi akhiran id komentar karena form ini bisa muncul di
            komentar mana pun. */}
        {replyingTo === comment.id && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <label className="sr-only" htmlFor={`replyContent-${comment.id}`}>
              Balasan untuk komentar {comment.user_name}
            </label>
            <textarea
              className="form-input text-sm w-full"
              id={`replyContent-${comment.id}`}
              rows={2}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Tulis balasan..."
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleReply(comment.id)}
                disabled={isSubmitting || !replyContent.trim()}
                className="button-primary text-xs py-1.5 px-3 flex items-center gap-1"
              >
                <Send size={12} aria-hidden="true" />
                <span>Kirim</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setReplyingTo(null);
                  setReplyContent("");
                }}
                className="button-secondary text-xs py-1.5 px-3"
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Render replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-3 mt-3">
          {comment.replies.map(reply => renderComment(reply, true))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
        <MessageCircle size={20} className="text-slate-600" aria-hidden="true" />
        <h3 className="text-lg font-bold text-slate-900">
          Diskusi & Tanya Jawab ({comments.filter(c => !c.parent_comment_id).length})
        </h3>
      </div>

      {/* New comment form — label `sr-only`, alasannya sama dengan form balasan. */}
      <form onSubmit={handleSubmitComment} className="space-y-3">
        <label className="sr-only" htmlFor="newComment">
          Pertanyaan atau komentar tentang materi ini
        </label>
        <textarea
          className="form-input text-sm w-full"
          id="newComment"
          rows={3}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Tulis pertanyaan atau komentar tentang materi ini..."
          disabled={isSubmitting}
        />
        <button
          type="submit"
          disabled={isSubmitting || !newComment.trim()}
          className="button-primary text-sm flex items-center gap-2"
        >
          <Send size={16} aria-hidden="true" />
          <span>{isSubmitting ? "Mengirim..." : "Kirim Komentar"}</span>
        </button>
      </form>

      {/* Comments list */}
      <div className="space-y-4">
        {pinnedComments.length === 0 && regularComments.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
            <MessageCircle size={48} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p className="text-sm font-semibold">Belum ada diskusi</p>
            <p className="text-xs mt-1">Jadilah yang pertama bertanya atau berkomentar</p>
          </div>
        ) : (
          <>
            {pinnedComments.map(comment => renderComment(comment))}
            {regularComments.map(comment => renderComment(comment))}
          </>
        )}
      </div>
    </div>
  );
}
