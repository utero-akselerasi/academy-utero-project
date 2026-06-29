import { deleteBoardAction } from "@/features/tasks/actions";
import { Trash2 } from "lucide-react";
import { CreateBoardForm } from "@/features/tasks/CreateBoardForm";
import { getMentorBoards } from "@/features/tasks/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
}

export default async function MentorTasksPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: boards, error } = await getMentorBoards(user.id);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase text-teal-700">Mentor</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Task Management</h1>
        <p className="mt-2 max-w-2xl leading-7 text-slate-600">
          Kelola board, list, dan task card untuk peserta bimbingan.
        </p>
      </div>

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
                  <p className="mt-2 text-xs text-slate-400">
                    Dibuat {formatDate(board.created_at)}
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
    </main>
  );
}
