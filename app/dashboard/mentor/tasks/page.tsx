import { deleteBoardAction } from "@/features/tasks/actions";
import { Trash2, ShieldAlert, BarChart2, Eye, Calendar } from "lucide-react";
import { CreateBoardForm } from "@/features/tasks/CreateBoardForm";
import { getMentorBoards } from "@/features/tasks/queries";
import { createSupabaseServerClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
}

const priorityConfig = {
  urgent: { label: "Urgent", badge: "bg-red-50 border-red-200 text-red-800" },
  high: { label: "High", badge: "bg-orange-50 border-orange-200 text-orange-800" },
  medium: { label: "Medium", badge: "bg-blue-50 border-blue-200 text-blue-800" },
  low: { label: "Low", badge: "bg-slate-100 border-slate-200 text-slate-700" }
};

export default async function MentorTasksPage({ searchParams }: Props) {
  const { tab = "boards" } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: boards, error } = await getMentorBoards(user.id);

  // Fetch global task data for monitoring
  const db = await createUteroAcademyServiceRoleClient();
  const { data: allCards } = await db
    .from("task_cards")
    .select(`
      id,
      title,
      description,
      priority,
      due_at,
      created_by,
      intern_id,
      list_id,
      task_lists(name, board_id, task_boards(name))
    `)
    .order("created_at", { ascending: false });

  const { data: internProfiles } = await db.from("intern_profiles").select("id, full_name");
  const { data: userProfiles } = await db.from("user_profiles").select("id, full_name");

  const internsMap = new Map();
  if (internProfiles) {
    internProfiles.forEach(i => internsMap.set(i.id, i));
  }

  const profilesMap = new Map();
  if (userProfiles) {
    userProfiles.forEach(p => profilesMap.set(p.id, p));
  }

  const mappedCards = (allCards || []).map(card => {
    const list = Array.isArray(card.task_lists) ? card.task_lists[0] : card.task_lists;
    const board = list ? (Array.isArray((list as any).task_boards) ? (list as any).task_boards[0] : (list as any).task_boards) : null;
    const intern = card.intern_id ? internsMap.get(card.intern_id) : null;
    const creator = card.created_by ? profilesMap.get(card.created_by) : null;

    return {
      ...card,
      board_id: board?.id || "",
      board_name: board?.name || "No Board",
      list_name: list?.name || "No List",
      intern_name: intern?.full_name || "Belum ditugaskan",
      creator_name: creator?.full_name || "Sistem"
    };
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase text-teal-700">Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Task Management & Monitoring</h1>
        <p className="mt-2 max-w-2xl leading-7 text-slate-600">
          Kelola board, list, task card, serta pantau seluruh tugas anak magang secara global.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 mb-6 text-sm font-bold">
        <Link
          href="/dashboard/mentor/tasks?tab=boards"
          className={"px-4 py-2.5 border-b-2 -mb-px transition-all " + (
            tab === "boards" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-900"
          )}
        >
          Daftar Board Tugas
        </Link>
        <Link
          href="/dashboard/mentor/tasks?tab=monitor"
          className={"px-4 py-2.5 border-b-2 -mb-px transition-all " + (
            tab === "monitor" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-900"
          )}
        >
          Monitor Tugas Global ({mappedCards.length})
        </Link>
      </div>

      {tab === "boards" ? (
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="mb-4 text-lg font-bold text-slate-950">
              Board Saya
              <span className="ml-2 text-sm font-normal text-slate-500">({boards.length})</span>
            </h2>

            {error ? (
              <div className="surface p-4 text-sm font-semibold text-red-700">
                Gagal memuat board. Cek koneksi database.
              </div>
            ) : null}

            {boards.length === 0 && !error ? (
              <div className="surface p-8 text-center text-slate-600">
                Belum ada board. Buat board pertama di sebelah kanan.
              </div>
            ) : null}

            <div className="grid gap-3">
              {boards.map((board) => (
                <div
                  key={board.id}
                  className="surface flex items-center justify-between gap-4 p-5 hover:border-teal-500"
                >
                  <Link className="flex-1 min-w-0" href={`/dashboard/mentor/tasks/${board.id}`}>
                    <h3 className="font-bold text-slate-950 truncate">{board.name}</h3>
                    {board.description ? (
                      <p className="mt-1 text-sm text-slate-600 truncate">{board.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-400 font-semibold">
                      Dibuat oleh: <span className="text-teal-700 font-bold">{(board as any).owner_name || "Admin"}</span> pada {formatDate(board.created_at)}
                    </p>
                  </Link>
                  <form action={deleteBoardAction}>
                    <input type="hidden" name="boardId" value={board.id} />
                    <button
                      type="submit"
                      className="button-secondary text-red-600 hover:bg-red-50 p-2 min-h-0"
                      title="Hapus Board"
                    >
                      <Trash2 size={16} />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-bold text-slate-950">Buat Board Baru</h2>
            <CreateBoardForm />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Statistics Grid */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="surface p-4 bg-white border border-slate-200 rounded-xl">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Semua Tugas</span>
              <span className="text-2xl font-black text-slate-950 block mt-1">{mappedCards.length}</span>
            </div>
            <div className="surface p-4 bg-white border border-slate-200 rounded-xl">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sudah Ditugaskan</span>
              <span className="text-2xl font-black text-teal-700 block mt-1">
                {mappedCards.filter(c => c.intern_id).length}
              </span>
            </div>
            <div className="surface p-4 bg-white border border-slate-200 rounded-xl">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Belum Ditugaskan</span>
              <span className="text-2xl font-black text-amber-600 block mt-1">
                {mappedCards.filter(c => !c.intern_id).length}
              </span>
            </div>
          </div>

          {/* Table Monitor Global */}
          <div className="surface overflow-hidden bg-white border border-slate-200 rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-4">Board / List</th>
                    <th className="px-6 py-4">Tugas</th>
                    <th className="px-6 py-4">Peserta Magang</th>
                    <th className="px-6 py-4">Pembuat Tugas</th>
                    <th className="px-6 py-4">Prioritas</th>
                    <th className="px-6 py-4">Deadline</th>
                    <th className="px-6 py-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {mappedCards.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                        Belum ada kepingan tugas di board mana pun.
                      </td>
                    </tr>
                  ) : (
                    mappedCards.map((card) => {
                      const priorityStyle = priorityConfig[card.priority as keyof typeof priorityConfig] || priorityConfig.medium;
                      return (
                        <tr key={card.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-bold text-slate-900 block">{card.board_name}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{card.list_name}</span>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-800">
                            {card.title}
                          </td>
                          <td className="px-6 py-4 text-teal-800 font-bold whitespace-nowrap">
                            {card.intern_name}
                          </td>
                          <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                            {card.creator_name}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-2 py-0.5 text-[9px] font-bold rounded border ${priorityStyle.badge} uppercase`}>
                              {priorityStyle.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                            {card.due_at ? (
                              <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                <span>{formatDate(card.due_at)}</span>
                              </span>
                            ) : "-"}
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            {card.board_id ? (
                              <Link
                                href={`/dashboard/mentor/tasks/${card.board_id}?detailCardId=${card.id}`}
                                className="button-secondary text-[11px] font-bold px-2.5 py-1 min-h-0 inline-flex items-center gap-1"
                              >
                                <Eye size={12} />
                                Detail Task
                              </Link>
                            ) : "-"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
