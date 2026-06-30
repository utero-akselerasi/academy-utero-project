import { getAuditLogs } from "@/features/super-admin/audit";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AuditLogsPage() {
  const { data: logs, error } = await getAuditLogs();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase text-teal-700">Super Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Audit Log Viewer</h1>
        <p className="mt-2 max-w-2xl leading-7 text-slate-600">
          Riwayat log aktivitas penting dari admin, mentor, dan sistem untuk memantau perubahan data.
        </p>
      </div>

      {error ? (
        <div className="surface p-4 text-sm font-semibold text-red-700 mb-6">
          Gagal memuat log audit. Cek koneksi database.
        </div>
      ) : null}

      <div className="surface overflow-hidden bg-white border border-slate-200 rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">Waktu</th>
                <th className="px-6 py-4">Aktor / Pelaku</th>
                <th className="px-6 py-4">Aksi</th>
                <th className="px-6 py-4">Tipe Objek</th>
                <th className="px-6 py-4">ID Objek</th>
                <th className="px-6 py-4">Metadata / Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Belum ada riwayat aktivitas yang tercatat.
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-6 py-4 text-slate-900 font-bold">
                      {log.actor_name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-black uppercase border ${
                        log.action.includes("create")
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : log.action.includes("remove") || log.action.includes("delete")
                          ? "bg-red-50 border-red-200 text-red-800"
                          : "bg-teal-50 border-teal-200 text-teal-800"
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono">
                      {log.resource_type}
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-mono text-[10px]">
                      {log.resource_id || "-"}
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                      {log.metadata ? JSON.stringify(log.metadata) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
