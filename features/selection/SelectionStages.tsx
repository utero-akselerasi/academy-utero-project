"use client";

import { Children, type ReactNode, useEffect, useState } from "react";

const stages = [
  { id: "jalur", number: "01", title: "Siapkan jalur" },
  { id: "tes", number: "02", title: "Susun tes" },
  { id: "penugasan", number: "03", title: "Bagikan tes" },
  { id: "review", number: "04", title: "Tinjau hasil" },
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

  return <div className="space-y-4 sm:space-y-5">
    <nav aria-label="Tahap seleksi" className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:p-3">
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {stages.map((stage, index) => <a
          key={stage.id}
          href={`#${stage.id}`}
          aria-current={index === activeStage ? "step" : undefined}
          onClick={() => setActiveStage(index)}
          className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-[11px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:min-h-16 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm ${index === activeStage ? "bg-teal-50 text-teal-900 ring-1 ring-inset ring-teal-200" : "text-slate-600 hover:bg-slate-50"}`}
        ><span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold sm:size-7 sm:text-xs ${index === activeStage ? "bg-teal-800 text-white" : "bg-slate-100 text-slate-600"}`}>{stage.number}</span><span className="leading-4">{stage.title}</span></a>)}
      </div>
    </nav>
    <div className="min-w-0">
      {panels.map((panel, index) => <div key={stages[index]?.id ?? index} className={index === activeStage ? "block" : "hidden"}>{panel}</div>)}
      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 sm:mt-4 sm:px-4">
        {activeStage > 0 ? <a href={`#${stages[activeStage - 1].id}`} onClick={() => setActiveStage(activeStage - 1)} className="min-h-10 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Sebelumnya</a> : <span className="px-3 py-2 text-sm text-slate-400">Awal</span>}
        <span className="text-xs font-medium text-slate-500">Tahap {activeStage + 1} dari {stages.length}</span>
        {activeStage < stages.length - 1 ? <a href={`#${stages[activeStage + 1].id}`} onClick={() => setActiveStage(activeStage + 1)} className="min-h-10 rounded-lg px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Lanjut</a> : <span className="px-3 py-2 text-sm font-semibold text-teal-800">Selesai</span>}
      </div>
    </div>
  </div>;
}
