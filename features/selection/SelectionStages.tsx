"use client";

import { Children, type ReactNode, useEffect, useState } from "react";

const stages = [
  { id: "jalur", number: "01", title: "Jalur" },
  { id: "tes", number: "02", title: "Paket & soal" },
  { id: "penugasan", number: "03", title: "Penugasan" },
  { id: "review", number: "04", title: "Hasil" },
];

export function SelectionStages({ children }: { children: ReactNode }) {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const syncHash = () => {
      const index = stages.findIndex((stage) => `#${stage.id}` === window.location.hash);
      if (index < 0) return;
      setActiveStage(index);
      requestAnimationFrame(() => document.getElementById(stages[index].id)?.scrollIntoView({ block: "start" }));
    };

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const panels = Children.toArray(children);

  return <div className="grid items-start gap-4 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[15rem_minmax(0,1fr)]">
    <nav aria-label="Tahap seleksi" className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-6 lg:p-4">
      <p className="px-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Alur kerja</p>
      <div className="mt-2 grid grid-cols-4 gap-1 lg:mt-3 lg:grid-cols-1">
        {stages.map((stage, index) => <a
          key={stage.id}
          href={`#${stage.id}`}
          aria-current={index === activeStage ? "step" : undefined}
          onClick={() => setActiveStage(index)}
          className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 lg:flex-row lg:justify-start lg:gap-3 lg:px-2 lg:text-left lg:text-sm ${index === activeStage ? "bg-teal-50 text-teal-900" : "text-slate-700 hover:bg-slate-50"}`}
        ><span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-teal-800 lg:size-8">{stage.number}</span><span className="leading-4">{stage.title}</span></a>)}
      </div>
      <p className="mt-4 hidden border-t border-slate-100 px-2 pt-4 text-xs leading-5 text-slate-500 lg:block">Mulai dari jalur, lalu terbitkan tes sebelum menugaskannya.</p>
    </nav>
    <div className="min-w-0 space-y-4 lg:space-y-6">
      {panels.map((panel, index) => <div key={stages[index]?.id ?? index} className={index === activeStage ? "block" : "hidden lg:block"}>{panel}</div>)}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 lg:hidden">
        {activeStage > 0 ? <a href={`#${stages[activeStage - 1].id}`} onClick={() => setActiveStage(activeStage - 1)} className="min-h-10 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Sebelumnya</a> : <span className="px-3 py-2 text-sm text-slate-400">Awal</span>}
        <span className="text-xs font-medium text-slate-500">Tahap {activeStage + 1} dari {stages.length}</span>
        {activeStage < stages.length - 1 ? <a href={`#${stages[activeStage + 1].id}`} onClick={() => setActiveStage(activeStage + 1)} className="min-h-10 rounded-lg px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Lanjut</a> : <span className="px-3 py-2 text-sm font-semibold text-teal-800">Selesai</span>}
      </div>
    </div>
  </div>;
}
