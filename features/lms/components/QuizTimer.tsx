"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";

interface QuizTimerProps {
  timeLimitMinutes: number;
  startedAt: string;
  onTimeUp: () => void;
}

export function QuizTimer({ timeLimitMinutes, startedAt, onTimeUp }: QuizTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isWarning, setIsWarning] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const start = new Date(startedAt).getTime();
      const limit = timeLimitMinutes * 60 * 1000; // Convert to milliseconds
      const now = Date.now();
      const elapsed = now - start;
      const remaining = limit - elapsed;

      return Math.max(0, Math.floor(remaining / 1000)); // Return seconds
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      // Warning ketika tersisa 2 menit atau 20% dari waktu (mana yang lebih kecil)
      const warningThreshold = Math.min(120, timeLimitMinutes * 60 * 0.2);
      setIsWarning(remaining <= warningThreshold && remaining > 0);

      if (remaining <= 0) {
        clearInterval(interval);
        onTimeUp();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLimitMinutes, startedAt, onTimeUp]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getProgressPercentage = () => {
    const totalSeconds = timeLimitMinutes * 60;
    return (timeLeft / totalSeconds) * 100;
  };

  if (timeLeft === 0) {
    return (
      <div className="fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-pulse z-50">
        <AlertTriangle size={24} />
        <div>
          <p className="font-bold text-sm">Waktu Habis!</p>
          <p className="text-xs opacity-90">Kuis akan disubmit otomatis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-xl z-50 transition-all ${
      isWarning 
        ? "bg-amber-500 text-white animate-pulse" 
        : "bg-white border-2 border-slate-200"
    }`}>
      <div className="flex items-center gap-3">
        <Clock size={20} className={isWarning ? "text-white" : "text-slate-600"} />
        <div>
          <p className={`text-xs font-semibold ${isWarning ? "text-white/80" : "text-slate-500"}`}>
            Waktu Tersisa
          </p>
          <p className={`text-2xl font-black ${isWarning ? "text-white" : "text-slate-900"}`}>
            {formatTime(timeLeft)}
          </p>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ${
            isWarning ? "bg-white" : "bg-teal-500"
          }`}
          style={{ width: `${getProgressPercentage()}%` }}
        />
      </div>
    </div>
  );
}
