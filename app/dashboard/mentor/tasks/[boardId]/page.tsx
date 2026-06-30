import { AddCardForm } from "@/features/tasks/AddCardForm";
import { AddChecklistForm } from "@/features/tasks/AddChecklistForm";
import { AddListForm } from "@/features/tasks/AddListForm";
import { ChecklistItem } from "@/features/tasks/ChecklistItem";
import { SubtaskItem } from "@/features/tasks/SubtaskItem";
import { AddSubtaskForm } from "@/features/tasks/AddSubtaskForm";
import { TaskAttachmentForm } from "@/features/tasks/TaskAttachmentForm";
import { getBoardWithLists } from "@/features/tasks/queries";
import { getActiveInterns } from "@/features/admin/queries";
import { deleteCardAction, assignCardToInternAction, deleteListAction, updateCardPriorityAction } from "@/features/tasks/actions";
import { ImagePreview } from "@/features/daily-reports/ImagePreview";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2, Calendar, ClipboardCheck, Paperclip, User, ArrowLeft, Kanban as KanbanIcon, List as ListIcon, AlertCircle, X, ChevronRight, BarChart2 } from "lucide-react";

type Props = {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{ view?: string; detailCardId?: string }>;
};

function formatDue(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function isImageAttachment(att: { mime_type?: string | null; file_name: string }) {
  if (att.mime_type && att.mime_type.startsWith("image/")) {
    return true;
  }
  const ext = att.file_name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
}

const priorityConfig = {
  urgent: { label: "Urgent", badge: "bg-red-50 border-red-200 text-red-800", indicator: "bg-red-500" },
  high: { label: "High", badge: "bg-orange-50 border-orange-200 text-orange-800", indicator: "bg-orange-500" },
  medium: { label: "Medium", badge: "bg-blue-50 border-blue-200 text-blue-800", indicator: "bg-blue-500" },
  low: { label: "Low", badge: "bg-slate-100 border-slate-200 text-slate-700", indicator: "bg-slate-400" }
};

export default async function BoardDetailPage({ params, searchParams }: Props) {
  const { boardId } = await params;
  const { view: activeView = "kanban", detailCardId } = await searchParams;

  const { data: board, error } = await getBoardWithLists(boardId);
  const interns = await getActiveInterns();

  if (!board || error) {
    notFound();
  }

  // Cari semua kartu tugas untuk detail modal jika ada detailCardId
  const allCards = board.task_lists.flatMap(l => l.task_cards);
  const detailCard = detailCardId ? allCards.find(c => c.id === detailCardId) : undefined;
  const detailCardList = detailCard ? board.task_lists.find(l => l.task_cards.some(c => c.id === detailCard.id)) : undefined;

  return (
    <main className="mx-auto max-w-full px-6 py-6 h-[calc(100vh-80px)] flex flex-col bg-slate-50 relative">
      {/* Header Board Minimalis Ala Plane */}
      <div className="mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/mentor/tasks" className="button-secondary text-xs h-8 py-0 px-2.5 min-h-0 flex items-center gap-1">
            <ArrowLeft size={14} />
            <span>Semua Board</span>
          </Link>
          <div className="h-4 w-px bg-slate-300" />
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-none">{board.name}</h1>
            {board.description ? (
              <p className="mt-1 text-xs text-slate-500 font-semibold">{board.description}</p>
            ) : null}
          </div>
        </div>

        {/* View Toggle & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Toggle View Tabs */}
          <div className="flex bg-slate-200/80 p-1 rounded-lg text-xs font-bold">
            <Link
              href={"/dashboard/mentor/tasks/" + boardId + "?view=kanban"}
              className={"flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all " + (
                activeView === "kanban" ? "bg-white text-teal-700 shadow-sm" : "text-slate-600 hover:text-slate-950"
              )}
            >
              <KanbanIcon size={14} />
              <span>Kanban</span>
            </Link>
            <Link
              href={"/dashboard/mentor/tasks/" + boardId + "?view=list"}
              className={"flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all " + (
                activeView === "list" ? "bg-white text-teal-700 shadow-sm" : "text-slate-600 hover:text-slate-950"
              )}
            >
              <ListIcon size={14} />
              <span>List</span>
            </Link>
          </div>

          <div className="h-4 w-px bg-slate-300 hidden md:block" />

          {/* Form Tambah List */}
          <AddListForm boardId={board.id} />
        </div>
      </div>

      {/* RENDER KANBAN VIEW (BOARD) */}
      {activeView === "kanban" && (
        <div className="flex-1 flex gap-5 overflow-x-auto pb-4 items-start select-none">
          {board.task_lists.map((list) => {
            const cardCount = list.task_cards.length;
            
            return (
              <section 
                className="w-72 shrink-0 bg-slate-100/60 border border-slate-200/50 rounded-xl p-3 flex flex-col max-h-[75vh] shadow-sm" 
                key={list.id}
              >
                {/* Header Kolom */}
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200/40 pb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black text-slate-800 truncate max-w-[130px]">{list.name}</h2>
                    <span className="bg-slate-200/80 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                      {cardCount}
                    </span>
                  </div>
                  
                  <form action={deleteListAction}>
                    <input type="hidden" name="listId" value={list.id} />
                    <input type="hidden" name="boardId" value={board.id} />
                    <button
                      type="submit"
                      className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 flex items-center justify-center transition-colors"
                      title="Hapus List"
                    >
                      <Trash2 size={14} />
                    </button>
                  </form>
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-0.5 min-h-[50px]">
                  {list.task_cards.map((card) => {
                    const total = card.task_checklists.length;
                    const done = card.task_checklists.filter((c) => c.is_done).length;
                    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
                    
                    const subtasks = (card as any).task_subtasks || [];
                    const subTotal = subtasks.length;
                    const subDone = subtasks.filter((s: any) => s.is_done).length;
                    const subProgress = subTotal > 0 ? Math.round((subDone / subTotal) * 100) : 0;

                    const assignedIntern = card.intern_id ? interns.find(i => i.id === card.intern_id) : null;
                    const cardPriority = card.priority || "medium";
                    const priorityStyle = priorityConfig[cardPriority];

                    return (
                      <Link
                        href={"/dashboard/mentor/tasks/" + boardId + "?view=" + activeView + "&detailCardId=" + card.id}
                        key={card.id}
                        className="group/card rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md hover:border-teal-500/40 transition-all duration-200 flex flex-col gap-2.5 cursor-pointer"
                      >
                        {/* Judul & Badge Prioritas Kecil */}
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">
                            {card.title}
                          </h3>
                          <span className={"h-2 w-2 rounded-full shrink-0 mt-1 " + priorityStyle.indicator} title={"Prioritas: " + priorityStyle.label} />
                        </div>

                        {/* Deskripsi Singkat */}
                        {card.description && (
                          <p className="text-[10px] text-slate-500 font-semibold line-clamp-2 leading-relaxed bg-slate-50 p-1.5 rounded">
                            {card.description}
                          </p>
                        )}

                        {/* Progress Bar (Jika ada sub-tugas) */}
                        {subTotal > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[9px] font-bold text-slate-400">
                              <span>Sub-task ({subDone}/{subTotal})</span>
                              <span>{subProgress}%</span>
                            </div>
                            <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: subProgress + "%" }} />
                            </div>
                          </div>
                        )}

                        {/* Progress Checklist (Siswa) */}
                        {total > 0 && (
                          <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                            <ClipboardCheck size={11} className="text-teal-600" />
                            <span>Bukti Kerja ({done}/{total})</span>
                          </div>
                        )}

                        {/* Footer Card: Deadline & Assignee Avatar Bulat */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                          {/* Deadline */}
                          {card.due_at ? (
                            <span className="flex items-center gap-1 text-[9px] text-slate-400 font-bold">
                              <Calendar size={10} />
                              <span>{formatDue(card.due_at).slice(0, 11)}</span>
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-300 font-bold">No Date</span>
                          )}

                          {/* Assignee Avatar */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            {assignedIntern ? (
                              <div 
                                className="h-5 w-5 rounded-full bg-teal-100 text-teal-800 text-[9px] font-black flex items-center justify-center border border-teal-200 shrink-0"
                                title={"Ditugaskan ke: " + assignedIntern.full_name}
                              >
                                {getInitials(assignedIntern.full_name)}
                              </div>
                            ) : (
                              <div 
                                className="h-5 w-5 rounded-full bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center shrink-0"
                                title="Belum ditugaskan"
                              >
                                <User size={10} />
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                <div className="mt-3 shrink-0">
                  <AddCardForm listId={list.id} interns={interns} />
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* RENDER LIST VIEW */}
      {activeView === "list" && (
        <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-sm">
          {board.task_lists.map((list) => {
            const listCards = list.task_cards;
            return (
              <div key={list.id} className="border-b border-slate-200 last:border-0">
                <div className="bg-slate-50/80 px-4 py-2 border-b border-slate-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-700">{list.name}</span>
                    <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {listCards.length}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {listCards.length === 0 ? (
                    <p className="p-4 text-xs text-slate-400 italic text-center">Tidak ada tugas di kolom ini.</p>
                  ) : (
                    listCards.map((card) => {
                      const assignedIntern = card.intern_id ? interns.find(i => i.id === card.intern_id) : null;
                      const priorityStyle = priorityConfig[card.priority || "medium"];
                      const subtasks = (card as any).task_subtasks || [];
                      const subDone = subtasks.filter((s: any) => s.is_done).length;
                      
                      return (
                        <Link 
                          key={card.id} 
                          href={"/dashboard/mentor/tasks/" + boardId + "?view=" + activeView + "&detailCardId=" + card.id}
                          className="p-3 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-all text-xs font-semibold cursor-pointer block"
                        >
                          <div className="min-w-0 flex items-center gap-3 flex-1">
                            <span className={"h-2 w-2 rounded-full shrink-0 " + priorityStyle.indicator} />
                            <div className="truncate">
                              <span className="font-bold text-slate-900 block truncate">{card.title}</span>
                              <span className="text-[10px] text-slate-400 font-medium truncate block max-w-sm mt-0.5">
                                {card.description || "Tidak ada deskripsi."}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            {subtasks.length > 0 && (
                              <span className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-bold shrink-0">
                                ?? {subDone}/{subtasks.length} subtasks
                              </span>
                            )}

                            {card.due_at && (
                              <span className="text-[10px] text-slate-500 font-bold">
                                Batas: {formatDue(card.due_at)}
                              </span>
                            )}

                            <div className="flex items-center gap-1.5">
                              {assignedIntern ? (
                                <div className="h-5 w-5 rounded-full bg-teal-100 text-teal-800 text-[9px] font-black flex items-center justify-center border border-teal-200 shrink-0">
                                  {getInitials(assignedIntern.full_name)}
                                </div>
                              ) : (
                                <div className="h-5 w-5 rounded-full bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center shrink-0">
                                  <User size={10} />
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* POPUP MODAL DETAIL TUGAS (KANBAN PREVIEW ALA PLANE) */}
      {detailCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div className="min-w-0">
                <span className="text-[10px] font-black text-teal-700 bg-teal-50 px-2.5 py-1 rounded border border-teal-100 uppercase">
                  Detail Tugas / Kolom: {detailCardList?.name || "Tugas"}
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1.5 truncate max-w-lg" title={detailCard.title}>
                  {detailCard.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Form Hapus Card */}
                <form action={deleteCardAction}>
                  <input type="hidden" name="cardId" value={detailCard.id} />
                  <input type="hidden" name="boardId" value={board.id} />
                  <button
                    type="submit"
                    className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-all flex items-center justify-center"
                    title="Hapus Tugas Selamanya"
                  >
                    <Trash2 size={16} />
                  </button>
                </form>
                <Link
                  href={"/dashboard/mentor/tasks/" + boardId + "?view=" + activeView}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
                >
                  <X size={18} />
                </Link>
              </div>
            </div>

            {/* Content Body Split Layout */}
            <div className="flex-1 overflow-y-auto grid md:grid-cols-[1.6fr_1fr] divide-y md:divide-y-0 md:divide-x divide-slate-100">
              {/* Kolom Kiri: Deskripsi & Sub-task */}
              <div className="p-6 space-y-5">
                {/* Deskripsi */}
                <div>
                  <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider mb-2">Deskripsi Tugas</h4>
                  <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 whitespace-pre-wrap">
                    {detailCard.description || "Tidak ada deskripsi detail untuk tugas ini."}
                  </p>
                </div>

                {/* Sub-tasks (Internal Checklist) */}
                <div>
                  <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider mb-2">Sub-task Checklist</h4>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                    <div className="grid gap-2 max-h-56 overflow-y-auto pr-1">
                      {((detailCard as any).task_subtasks || []).length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Belum ada sub-task.</p>
                      ) : (
                        ((detailCard as any).task_subtasks || []).map((sub: any) => (
                          <SubtaskItem item={sub} key={sub.id} />
                        ))
                      )}
                    </div>
                    <AddSubtaskForm cardId={detailCard.id} />
                  </div>
                </div>

                {/* Checklist Bukti Kerja (Intern) */}
                <div>
                  <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider mb-2">Checklist Bukti Siswa</h4>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                    <div className="grid gap-2 max-h-56 overflow-y-auto pr-1">
                      {detailCard.task_checklists.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Belum ada item bukti checklist.</p>
                      ) : (
                        detailCard.task_checklists.map((cl) => (
                          <ChecklistItem item={cl} key={cl.id} />
                        ))
                      )}
                    </div>
                    <AddChecklistForm cardId={detailCard.id} />
                  </div>
                </div>
              </div>

              {/* Kolom Kanan: Atribut (Assignee, Priority, Lampiran) */}
              <div className="p-6 bg-slate-50/50 space-y-5">
                <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-2">Properties</h4>

                {/* Assignee Form */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 block">Ditugaskan Kepada</label>
                  <form action={assignCardToInternAction} className="flex gap-1.5">
                    <input name="cardId" type="hidden" value={detailCard.id} />
                    <input name="boardId" type="hidden" value={board.id} />
                    <select 
                      name="internId" 
                      className="form-input text-xs py-1 px-2.5 h-8 bg-white" 
                      defaultValue={detailCard.intern_id || ""}
                    >
                      <option value="">Belum ditugaskan</option>
                      {interns.map(i => (
                        <option key={i.id} value={i.id}>{i.full_name}</option>
                      ))}
                    </select>
                    <button type="submit" className="button-primary text-xs h-8 py-0 px-3 min-h-0 font-bold shrink-0">
                      Set
                    </button>
                  </form>
                </div>

                {/* Priority Form */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 block">Tingkat Prioritas</label>
                  <form action={updateCardPriorityAction} className="flex gap-1.5">
                    <input name="cardId" type="hidden" value={detailCard.id} />
                    <select 
                      name="priority" 
                      className="form-input text-xs py-1 px-2.5 h-8 bg-white"
                      defaultValue={detailCard.priority || "medium"}
                    >
                      <option value="urgent">?? Urgent</option>
                      <option value="high">?? High</option>
                      <option value="medium">?? Medium</option>
                      <option value="low">? Low</option>
                    </select>
                    <button type="submit" className="button-primary text-xs h-8 py-0 px-3 min-h-0 font-bold shrink-0">
                      Set
                    </button>
                  </form>
                </div>

                {/* Deadline */}
                {detailCard.due_at && (
                  <div className="bg-white p-3 rounded-lg border border-slate-200/60 text-xs font-bold text-slate-600 flex items-center justify-between">
                    <span>Due Date:</span>
                    <span className="text-slate-800">{formatDue(detailCard.due_at)}</span>
                  </div>
                )}

                {/* Lampiran Bukti File */}
                <div className="border-t border-slate-200/80 pt-4 space-y-3">
                  <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Paperclip size={13} />
                    <span>Lampiran Bukti ({detailCard.task_attachments.length})</span>
                  </h4>

                  <div className="grid gap-2">
                    {detailCard.task_attachments.map((att) => {
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

                  <TaskAttachmentForm cardId={detailCard.id} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
              <Link
                href={"/dashboard/mentor/tasks/" + boardId + "?view=" + activeView}
                className="button-secondary text-sm font-semibold"
              >
                Tutup
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
