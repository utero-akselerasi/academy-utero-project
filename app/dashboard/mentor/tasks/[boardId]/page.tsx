import { getActiveInterns } from "@/features/admin/queries";
import { deleteCardAction, assignCardToInternAction } from "@/features/tasks/actions";
import { Trash2 } from "lucide-react";
import { AddCardForm } from "@/features/tasks/AddCardForm";
import { AddChecklistForm } from "@/features/tasks/AddChecklistForm";
import { AddListForm } from "@/features/tasks/AddListForm";
import { ChecklistItem } from "@/features/tasks/ChecklistItem";
import { TaskAttachmentForm } from "@/features/tasks/TaskAttachmentForm";
import { getBoardWithLists } from "@/features/tasks/queries";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ boardId: string }>;
};

function formatDue(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
}

export default async function BoardDetailPage({ params }: Props) {
  const { boardId } = await params;
  const { data: board, error } = await getBoardWithLists(boardId);
  const interns = await getActiveInterns();

  if (!board || error) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link className="button-secondary text-sm" href="/dashboard/mentor/tasks">
          ← Board
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-950">{board.name}</h1>
          {board.description ? (
            <p className="mt-1 text-sm text-slate-600">{board.description}</p>
          ) : null}
        </div>
      </div>

      <div className="mb-6">
        <AddListForm boardId={board.id} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {board.task_lists.map((list) => (
          <section className="surface p-4" key={list.id}>
            <h2 className="mb-3 text-lg font-bold text-slate-950">{list.name}</h2>

            <div className="grid gap-3">
              {list.task_cards.map((card) => {
                const total = card.task_checklists.length;
                const done = card.task_checklists.filter((c) => c.is_done).length;

                return (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={card.id}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900">{card.title}</h3>
                      <form action={deleteCardAction}>
                        <input type="hidden" name="cardId" value={card.id} />
                        <input type="hidden" name="boardId" value={board.id} />
                        <button type="submit" className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50" title="Hapus Task">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </div>
                    {card.description ? (
                      <p className="mt-1 text-sm text-slate-600">{card.description}</p>
                    ) : null}
                    {card.due_at ? (
                      <p className="mt-1 text-xs text-slate-400">Deadline: {formatDue(card.due_at)}</p>
                    ) : null}

                    {card.intern_id ? (
                      <div className="mt-2 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded px-2 py-1 inline-block">
                        ?? Ditugaskan ke: {interns.find(i => i.id === card.intern_id)?.full_name || "Peserta Magang"}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded px-2 py-1 inline-block">
                        ?? Belum ditugaskan
                      </div>
                    )}

                    <form action={assignCardToInternAction} className="mt-2 flex items-center gap-1">
                      <input name="cardId" type="hidden" value={card.id} />
                      <input name="boardId" type="hidden" value={board.id} />
                      <select name="internId" className="form-input text-xs py-1 px-2 h-7" defaultValue={card.intern_id || ""}>
                        <option value="">-- Assign Anak Magang --</option>
                        {interns.map(i => (
                          <option key={i.id} value={i.id}>{i.full_name}</option>
                        ))}
                      </select>
                      <button type="submit" className="button-secondary text-xs h-7 py-0 px-2 min-h-0 flex items-center justify-center">
                        Set
                      </button>
                    </form>

                    {total > 0 ? (
                      <div className="mt-2">
                        <p className="mb-1 text-xs font-bold text-slate-500">
                          Checklist ({done}/{total})
                        </p>
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
                  </div>
                );
              })}
            </div>

            <AddCardForm listId={list.id} interns={interns} />
          </section>
        ))}
      </div>
    </main>
  );
}
