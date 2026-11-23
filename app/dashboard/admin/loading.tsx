export default function AdminDashboardLoading() {
  return <main aria-label="Memuat dashboard admin" className="w-full animate-pulse space-y-4 px-3 py-4 sm:px-4 sm:py-5">
    <div className="h-40 rounded-xl bg-slate-200" />
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 rounded-xl border border-slate-200 bg-white" />)}</div>
    <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 2 }, (_, index) => <div key={index} className="h-72 rounded-xl border border-slate-200 bg-white" />)}</div>
  </main>;
}
