"use client";

import { useState } from "react";
import { MapPin, X } from "lucide-react";

type Props = {
  latitude: number;
  longitude: number;
  label: string;
};

export function AttendanceMap({ latitude, longitude, label }: Props) {
  const [showMap, setShowMap] = useState(false);

  const delta = 0.003;
  const minLon = longitude - delta;
  const minLat = latitude - delta;
  const maxLon = longitude + delta;
  const maxLat = latitude + delta;
  
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  const externalUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setShowMap(!showMap)}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 border border-teal-200 bg-teal-50 px-2 py-1 rounded hover:bg-teal-100 transition-all"
      >
        <MapPin size={12} />
        <span>{showMap ? "Sembunyikan Peta" : `Lihat Peta ${label}`}</span>
      </button>

      {showMap && (
        <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden bg-white shadow-inner">
          <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 border-b border-slate-200">
            <span className="text-[11px] font-bold text-slate-700">{label} ({latitude.toFixed(5)}, {longitude.toFixed(5)})</span>
            <div className="flex items-center gap-2">
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-teal-700 font-bold hover:underline"
              >
                Buka di OpenStreetMap
              </a>
              <button
                type="button"
                onClick={() => setShowMap(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            </div>
          </div>
          <iframe
            title={`Map for ${label}`}
            width="100%"
            height="220"
            frameBorder="0"
            scrolling="no"
            marginHeight={0}
            marginWidth={0}
            src={embedUrl}
            className="w-full border-none"
          />
        </div>
      )}
    </div>
  );
}
