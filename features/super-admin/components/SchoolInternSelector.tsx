"use client";

import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";

type Intern = {
  id: string;
  full_name: string;
  email: string | null;
  major: string | null;
  status: string;
  school_id: string | null;
};

type Props = {
  interns: Intern[];
  currentSchoolId: string;
  placeholder?: string;
};

export function SchoolInternSelector({ interns, currentSchoolId, placeholder = "Cari nama siswa..." }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = interns.filter((intern) =>
    intern.full_name.toLowerCase().includes(query.toLowerCase()) ||
    (intern.email || "").toLowerCase().includes(query.toLowerCase()) ||
    (intern.major || "").toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedIntern = interns.find((intern) => intern.id === selectedId);

  return (
    <div ref={wrapperRef} className="relative">
      <input type="hidden" name="internId" value={selectedId} required />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-xs outline-none focus:border-teal-500"
        />
      </div>

      {selectedIntern && !isOpen && (
        <div className="mt-2 rounded-lg border border-teal-200 bg-teal-50 p-2 text-xs">
          <p className="font-bold text-teal-900">{selectedIntern.full_name}</p>
          <p className="text-teal-700">{selectedIntern.email || "-"}</p>
          <button
            type="button"
            onClick={() => {
              setSelectedId("");
              setQuery("");
            }}
            className="mt-1 text-xs font-bold text-teal-800 hover:text-teal-900"
          >
            Ubah pilihan
          </button>
        </div>
      )}

      {isOpen && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-500">Tidak ada siswa ditemukan.</div>
          ) : (
            filtered.map((intern) => (
              <button
                key={intern.id}
                type="button"
                onClick={() => {
                  setSelectedId(intern.id);
                  setQuery(intern.full_name);
                  setIsOpen(false);
                }}
                className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-slate-50"
              >
                <p className="font-bold text-slate-900">{intern.full_name}</p>
                <p className="text-slate-600">{intern.email || "-"}</p>
                <p className="text-slate-500">
                  {intern.major || "Jurusan belum diisi"} · {intern.status}
                  {intern.school_id === currentSchoolId && <span className="ml-2 text-teal-700">(sudah di sini)</span>}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
