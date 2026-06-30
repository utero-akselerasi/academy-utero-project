import { AddChecklistForm } from "@/features/tasks/AddChecklistForm";
import { ChecklistItem } from "@/features/tasks/ChecklistItem";
import { SubtaskItem } from "@/features/tasks/SubtaskItem";
import { AddSubtaskForm } from "@/features/tasks/AddSubtaskForm";
import { TaskAttachmentForm } from "@/features/tasks/TaskAttachmentForm";
import { getInternCards } from "@/features/tasks/queries";
import { getInternProfileId } from "@/features/daily-reports/queries";
import { ImagePreview } from "@/features/daily-reports/ImagePreview";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Calendar, ClipboardCheck, Paperclip, Eye, Clock } from "lucide-react";

type Props = {
  searchParams: Promise<{ status?: string }>;
};

function formatDue(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
}

function isImageAttachment(att: { mime_type?: string | null; file_name: string }) {
  if (att.mime_type && att.mime_type.startsWith("image/")) {
    return true;
  }
  const ext = att.file_name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
}

const priorityConfig = {
  urgent: { label: "Urgent", badge: "bg-red-50 border-red-200 text-red-800" },
  high: { label: "High", badge: "bg-orange-50 border-orange-200 text-orange-800" },
  medium: { label: "Medium", badge: "bg-blue-50 border-blue-200 text-blue-800" },
  low: { label: "Low", badge: "bg-slate-100 border-slate-200 text-slate-700" }
};

export default async function InternTasksPage({ searchParams }: Props) {
  const { status: statusFilter = "all" } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const internProfileId = await getInternProfileId(user.id);
  if (!internProfileId) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="surface p-6 text-sm font-semibold text-red-700">
          Profil peserta belum ditemukan. Hubungi admin untuk setup profil.
        </div>
      </main>
    );
  }

  const { data: cards, error } = await getInternCards(internProfileId);

  // Filter tugas berdasarkan status penyelesaian (jika diperlukan di masa depan)
  const filteredCards = cards;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase text-teal-700">Peserta</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Task Saya</h1>
        <p className="mt-2 max-w-2xl leading-7 text-slate-600">
          Daftar tugas bimbingan yang harus dikerjakan. Selesaikan sub-task dan kumpulkan bukti lampiran pengerjaan.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        <span className="status-pill">{filteredCards.length} tugas aktif</span>
      </div>

      {error ? (
        <div className="surface p-4 text-sm font-semibold text-red-700 mb-6">
          Gagal memuat task. Cek koneksi database.
        </div>
      ) : null}

      {filteredCards.length === 0 && !error ? (
        <div className="surface p-8 text-center text-slate-600">
          Belum ada tugas yang ditugaskan untuk Anda saat ini.
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {filteredCards.map((card) => {
          const total = card.task_checklists.length;
          const done = card.task_checklists.filter((c) => c.is_done).length;
          
          // Subtasks progress
          const subtasks = (card as any).task_subtasks || [];
          const subTotal = subtasks.length;
          const subDone = subtasks.filter((s: any) => s.is_done).length;
          const progressPercent = subTotal > 0 ? Math.round((subDone / subTotal) * 100) : 0;

          const cardPriority = card.priority || "medium";
          const priorityStyle = priorityConfig[cardPriority];

          return (
            <article className="surface p-5 bg-white border border-slate-200 rounded-xl space-y-4 hover:border-teal-500/30 transition-all shadow-sm" key={card.id}>
              {/* Header Kartu */}
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-50 pb-2">
                <span className={"px-2 py-0.5 text-[9px] font-bold rounded border uppercase " + priorityStyle.badge}>
                  {priorityStyle.label}
                </span>
                {card.due_at && (
                  <span className="flex items-center gap-1 text-[10px] text-red-600 font-bold bg-red-50 border border-red-100 px-2 py-0.5 rounded uppercase">
                    <Clock size={10} />
                    <span>Batas: {formatDue(card.due_at)}</span>
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-950 leading-snug">{card.title}</h2>
                {card.description && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {card.description}
                  </p>
                )}
              </div>

              {/* Progress Subtasks (Daftar Kerja Internal ala Plane) */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span className="flex items-center gap-1">
                    <ClipboardCheck size={14} className="text-teal-600" />
                    <span>Daftar Sub-task ({subDone}/{subTotal})</span>
                  </span>
                  <span className="text-teal-700">{progressPercent}%</span>
                </div>
                {subTotal > 0 && (
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: progressPercent + "%" }} />
                  </div>
                )}
                <div className="grid gap-1 max-h-36 overflow-y-auto">
                  {subtasks.map((sub: any) => (
                    <SubtaskItem item={sub} key={sub.id} />
                  ))}
                </div>
                <AddSubtaskForm cardId={card.id} />
              </div>

              {/* Progress Checklist Bukti (Siswa) */}
              {total > 0 && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Bukti Checklist ({done}/{total})</span>
                  </div>
                  <div className="grid gap-1">
                    {card.task_checklists.map((cl) => (
                      <ChecklistItem item={cl} key={cl.id} />
                    ))}
                  </div>
                  <AddChecklistForm cardId={card.id} />
                </div>
              )}

              {/* Bukti Lampiran */}
              {card.task_attachments && card.task_attachments.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1">
                    <Paperclip size={13} />
                    <span>Lampiran Bukti Tugas ({card.task_attachments.length})</span>
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {card.task_attachments.map((att) => {
                      const isImg = isImageAttachment(att);
                      return (
                        <div key={att.id} className="surface p-2 border border-slate-200 rounded-lg bg-white flex flex-col justify-between">
                          {isImg ? (
                            <div className="w-full">
                              <p className="text-[10px] text-slate-400 font-bold truncate mb-1" title={att.file_name}>
                                {att.file_name}
                              </p>
                              <ImagePreview src={att.file_path} alt={att.file_name} className="max-h-24 w-auto object-contain mx-auto" />
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 py-1 justify-between h-full">
                              <span className="text-[10px] font-bold text-slate-700 truncate block" title={att.file_name}>
                                ?? {att.file_name}
                              </span>
                              <a href={att.file_path} target="_blank" rel="noopener noreferrer" className="button-secondary text-[10px] py-1 px-2.5 min-h-0 text-teal-700 border-teal-200 hover:bg-teal-50 font-bold text-center block w-full">
                                Unduh
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <TaskAttachmentForm cardId={card.id} />
            </article>
          );
        })}
      </div>
    </main>
  );
}
