"use client";

import { useState, useEffect } from "react";
import { moveCardAction, deleteListAction } from "@/features/tasks/actions";
import { AddCardForm } from "./AddCardForm";
import Link from "next/link";
import { 
  Trash2, Calendar, ClipboardCheck, User, ChevronRight 
} from "lucide-react";

type Props = {
  board: {
    id: string;
    name: string;
    task_lists: any[];
  };
  interns: any[];
  boardId: string;
  userProfiles: any[];
};

const priorityConfig = {
  urgent: { label: "Urgent", badge: "bg-red-50 border-red-200 text-red-800", indicator: "bg-red-500" },
  high: { label: "High", badge: "bg-orange-50 border-orange-200 text-orange-800", indicator: "bg-orange-500" },
  medium: { label: "Medium", badge: "bg-blue-50 border-blue-200 text-blue-800", indicator: "bg-blue-500" },
  low: { label: "Low", badge: "bg-slate-100 border-slate-200 text-slate-700", indicator: "bg-slate-400" }
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function KanbanBoard({ board, interns, boardId, userProfiles }: Props) {
  const [lists, setLists] = useState<any[]>(board.task_lists);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [draggedOverListId, setDraggedOverListId] = useState<string | null>(null);

  useEffect(() => {
    setLists(board.task_lists);
  }, [board.task_lists]);

  const profilesMap = new Map();
  if (userProfiles) {
    userProfiles.forEach((p) => profilesMap.set(p.id, p));
  }

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    setDraggingCardId(cardId);
    e.dataTransfer.setData("text/plain", cardId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, listId: string) => {
    e.preventDefault();
    setDraggedOverListId(listId);
  };

  const handleDragLeave = () => {
    setDraggedOverListId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetListId: string) => {
    e.preventDefault();
    setDraggedOverListId(null);
    const cardId = e.dataTransfer.getData("text/plain") || draggingCardId;
    if (!cardId) return;

    // Optimistic update
    let sourceCard: any = null;
    const newLists = lists.map((list) => {
      const filteredCards = list.task_cards.filter((c: any) => {
        if (c.id === cardId) {
          sourceCard = { ...c, list_id: targetListId };
          return false;
        }
        return true;
      });
      return { ...list, task_cards: filteredCards };
    });

    if (!sourceCard) return;

    const finalLists = newLists.map((list) => {
      if (list.id === targetListId) {
        return { ...list, task_cards: [...list.task_cards, sourceCard] };
      }
      return list;
    });

    setLists(finalLists);
    setDraggingCardId(null);

    try {
      await moveCardAction(cardId, targetListId, boardId);
    } catch (err) {
      alert("Gagal memindahkan tugas. Silakan coba lagi.");
      setLists(board.task_lists);
    }
  };

  return (
    <div className="flex-1 flex gap-5 overflow-x-auto pb-4 items-start select-none">
      {lists.map((list) => {
        const cardCount = list.task_cards.length;
        const isDraggedOver = draggedOverListId === list.id;

        return (
          <section
            className={`w-72 shrink-0 bg-slate-50 border rounded-xl p-3 flex flex-col max-h-[75vh] shadow-sm transition-all ${
              isDraggedOver ? "border-teal-500 bg-teal-50/20 ring-2 ring-teal-500/20" : "border-slate-200/60"
            }`}
            key={list.id}
            onDragOver={(e) => handleDragOver(e, list.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, list.id)}
          >
            {/* Header Kolom */}
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200/50 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-black text-slate-800 truncate max-w-[130px]">
                  {list.name}
                </h2>
                <span className="bg-slate-200/80 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                  {cardCount}
                </span>
              </div>

              <form action={deleteListAction}>
                <input type="hidden" name="listId" value={list.id} />
                <input type="hidden" name="boardId" value={boardId} />
                <button
                  type="submit"
                  className="text-slate-400 hover:text-red-650 p-1 rounded hover:bg-red-50 flex items-center justify-center transition-colors"
                  title="Hapus List"
                >
                  <Trash2 size={13} />
                </button>
              </form>
            </div>

            {/* Cards Container */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-0.5 min-h-[150px]">
              {list.task_cards.map((card: any) => {
                const total = card.task_checklists?.length || 0;
                const done = card.task_checklists?.filter((c: any) => c.is_done).length || 0;

                const subtasks = card.task_subtasks || [];
                const subTotal = subtasks.length;
                const subDone = subtasks.filter((s: any) => s.is_done).length;
                const subProgress = subTotal > 0 ? Math.round((subDone / subTotal) * 100) : 0;

                const assignedIntern = card.intern_id
                  ? interns.find((i) => i.id === card.intern_id)
                  : null;
                const cardPriority = card.priority || "medium";
                const priorityStyle =
                  priorityConfig[cardPriority as keyof typeof priorityConfig] ||
                  priorityConfig.medium;

                const isDraggingThis = draggingCardId === card.id;

                return (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, card.id)}
                    className={`block transition-all ${
                      isDraggingThis ? "opacity-30 scale-95" : ""
                    }`}
                  >
                    <Link
                      href={
                        "/dashboard/mentor/tasks/" +
                        boardId +
                        "?view=kanban&detailCardId=" +
                        card.id
                      }
                      className="group/card rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md hover:border-teal-500/50 transition-all duration-200 flex flex-col gap-2.5 cursor-pointer"
                    >
                      {/* Judul & Badge Prioritas */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-xs font-extrabold text-slate-800 leading-snug line-clamp-2">
                          {card.title}
                        </h3>
                        <span
                          className={
                            "h-2 w-2 rounded-full shrink-0 mt-1 " +
                            priorityStyle.indicator
                          }
                          title={"Prioritas: " + priorityStyle.label}
                        />
                      </div>

                      {/* Deskripsi */}
                      {card.description && (
                        <p className="text-[10px] text-slate-500 font-semibold line-clamp-2 leading-relaxed bg-slate-50 p-1.5 rounded">
                          {card.description}
                        </p>
                      )}

                      {/* Sub-task Progress */}
                      {subTotal > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[9px] font-bold text-slate-400">
                            <span>Sub-task ({subDone}/{subTotal})</span>
                            <span>{subProgress}%</span>
                          </div>
                          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-teal-500 rounded-full transition-all"
                              style={{ width: subProgress + "%" }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Checklist Progress */}
                      {total > 0 && (
                        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                          <ClipboardCheck size={11} className="text-teal-600" />
                          <span>Bukti Kerja ({done}/{total})</span>
                        </div>
                      )}

                      {/* Footer Card */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                        {card.due_at ? (
                          <span className="flex items-center gap-1 text-[9px] text-slate-400 font-bold">
                            <Calendar size={10} />
                            <span>
                              {new Intl.DateTimeFormat("id-ID", {
                                dateStyle: "short",
                              }).format(new Date(card.due_at))}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-350 font-bold">No Date</span>
                        )}

                        <div className="flex items-center gap-1.5 min-w-0">
                          {(() => {
                            const creator = card.created_by
                              ? profilesMap.get(card.created_by)
                              : null;
                            const creatorName = creator?.full_name || "Sistem";
                            return (
                              <div
                                className="h-5 w-5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-black flex items-center justify-center border border-slate-200 shrink-0"
                                title={"Dibuat oleh: " + creatorName}
                              >
                                {getInitials(creatorName)}
                              </div>
                            );
                          })()}

                          <ChevronRight size={8} className="text-slate-300 shrink-0" />

                          {assignedIntern ? (
                            <div
                              className="h-5 w-5 rounded-full bg-teal-50 text-teal-800 text-[9px] font-black flex items-center justify-center border border-teal-200 shrink-0"
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
                  </div>
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
  );
}
