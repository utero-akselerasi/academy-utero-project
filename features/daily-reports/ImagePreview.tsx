"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn } from "lucide-react";

type Props = {
  src: string;
  alt: string;
  className?: string;
};

export function ImagePreview({ src, alt, className = "max-h-28 w-auto object-contain mx-auto" }: Props) {
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
      <div 
        onClick={handleOpen}
        className="relative group cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-1 transition-all hover:border-teal-500 hover:shadow-sm"
      >
        <img
          src={src}
          alt={alt}
          className={className}
        />
        <div
          className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg"
        >
          <span className="bg-white/90 text-slate-800 p-1.5 rounded-full shadow-sm">
            <ZoomIn size={14} className="text-teal-700 font-bold" />
          </span>
        </div>
      </div>

      {isOpen && typeof document !== "undefined" && createPortal(
        <div 
          onClick={handleClose}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
          <div className="absolute inset-0" />
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative max-w-3xl max-h-[85vh] w-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-200 z-10"
          >
            <button
              onClick={handleClose}
              className="absolute -top-10 right-0 text-white/85 hover:text-white bg-slate-800/80 p-2 rounded-full hover:bg-slate-800 transition-all flex items-center justify-center shadow-lg"
            >
              <X size={20} />
            </button>
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-white/10 bg-black/40"
            />
            <p className="text-white text-xs font-semibold mt-3 bg-slate-900/60 px-3 py-1 rounded-full border border-white/5 truncate max-w-md">
              {alt}
            </p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
