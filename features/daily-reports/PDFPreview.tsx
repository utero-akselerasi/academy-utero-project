"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, FileText } from "lucide-react";

type Props = {
  src: string;
  fileName: string;
  className?: string;
};

export function PDFPreview({ src, fileName, className = "max-h-28 w-auto object-contain mx-auto" }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(true);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition-all w-full text-xs font-semibold"
        title={fileName}
      >
        <FileText size={14} />
        <span className="truncate">Lihat PDF</span>
      </button>

      {isOpen && typeof document !== "undefined" && createPortal(
        <div 
          onClick={handleClose}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
          <div className="absolute inset-0" />
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative max-w-4xl max-h-[85vh] w-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-200 z-10"
          >
            <button
              onClick={handleClose}
              className="absolute -top-10 right-0 text-white/85 hover:text-white bg-slate-800/80 p-2 rounded-full hover:bg-slate-800 transition-all flex items-center justify-center shadow-lg"
            >
              <X size={20} />
            </button>
            <iframe
              src={src}
              className="w-full h-full rounded-lg shadow-2xl border border-white/10"
              title={fileName}
              style={{ minHeight: "500px" }}
            />
            <p className="text-white text-xs font-semibold mt-3 bg-slate-900/60 px-3 py-1 rounded-full border border-white/5 truncate max-w-md">
              {fileName}
            </p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
