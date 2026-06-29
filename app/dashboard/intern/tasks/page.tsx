import { AddChecklistForm } from "@/features/tasks/AddChecklistForm";
import { ChecklistItem } from "@/features/tasks/ChecklistItem";
import { TaskAttachmentForm } from "@/features/tasks/TaskAttachmentForm";
import { getInternCards } from "@/features/tasks/queries";
import { getInternProfileId } from "@/features/daily-reports/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function formatDue(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
}

export default async function InternTasksPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase text-teal-700">Peserta</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Task Saya</h1>
        <p className="mt-2 max-w-2xl leading-7 text-slate-600">
          Daftar task yang ditugaskan mentor. Centang checklist untuk update progress dan unggah bukti/lampiran.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        <span className="status-pill">{cards.length} task</span>
      </div>

      {error ? (
        <div className="surface p-4 text-sm font-semibold text-red-700">
          Gagal memuat task. Cek koneksi database.
        </div>
      ) : null}

      {cards.length === 0 && !error ? (
        <div className="surface p-8 text-center text-slate-600">
          Belum ada task yang ditugaskan. Mentor akan menambahkan task melalui board.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => {
          const total = card.task_checklists.length;
          const done = card.task_checklists.filter((c) => c.is_done).length;
          const progress = total > 0 ? Math.round((done / total) * 100) : 0;

          return (
            <article className="surface p-5" key={card.id}>
              <h2 className="font-bold text-slate-950">{card.title}</h2>
              {card.description ? (
                <p className="mt-1 text-sm leading-6 text-slate-600">{card.description}</p>
              ) : null}
              {card.due_at ? (
                <p className="mt-2 text-xs text-slate-400">Deadline: {formatDue(card.due_at)}</p>
              ) : null}

              {total > 0 ? (
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">
                      Checklist ({done}/{total})
                    </span>
                    <span className="text-xs font-bold text-teal-700">{progress}%</span>
                  </div>
                  <div className="mb-2 h-1.5 w-full rounded-full bg-slate-200">
                    <div
                      className="h-1.5 rounded-full bg-teal-500 transition-all"
                      style={{ width: progress + "%" }}
                    />
                  </div>
                  <div className="grid gap-1">
                    {card.task_checklists.map((cl) => (
                      <ChecklistItem item={cl} key={cl.id} />
                    ))}
                  </div>
                </div>
              ) : null}

              <AddChecklistForm cardId={card.id} />

              {card.task_attachments && card.task_attachments.length > 0 && (
                <div className="mt-3 border-t border-slate-200 pt-2">
                  <p className="text-xs font-bold text-slate-500 mb-1">Lampiran</p>
                  <div className="grid gap-1">
                    {card.task_attachments.map((att) => (
                      <a key={att.id} href={att.file_path} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-700 font-bold hover:underline flex items-center gap-1">
                        📎 {att.file_name}
                      </a>
                    ))}
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
