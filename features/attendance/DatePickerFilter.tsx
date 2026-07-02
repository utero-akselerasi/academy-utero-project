"use client";

export function DatePickerFilter({
  defaultValue,
  detailInternId,
  showSettings,
  actionUrl,
}: {
  defaultValue: string;
  detailInternId?: string;
  showSettings?: string;
  actionUrl: string;
}) {
  return (
    <form method="GET" action={actionUrl} className="flex items-center gap-2">
      {detailInternId && <input type="hidden" name="detailInternId" value={detailInternId} />}
      {showSettings && <input type="hidden" name="showSettings" value={showSettings} />}
      <input
        type="date"
        name="date"
        defaultValue={defaultValue}
        className="border border-slate-200 rounded-lg text-xs px-2.5 bg-white h-9 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-slate-850 font-bold"
        onChange={(e) => e.target.form?.submit()}
      />
    </form>
  );
}
