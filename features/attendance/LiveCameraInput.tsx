"use client";

import React, { useRef, useState } from "react";
import { Camera, RefreshCw, CheckCircle2 } from "lucide-react";

export function LiveCameraInput() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState("");

  const startCamera = async () => {
    setError("");
    setCameraActive(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error(err);
      setError("Gagal mengakses kamera. Pastikan izin kamera diberikan.");
      setCameraActive(false);
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        // Set canvas size to match video aspect ratio
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to base64 jpeg
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setPhoto(dataUrl);
        
        // Stop stream
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const retake = () => {
    setPhoto(null);
    startCamera();
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <canvas ref={canvasRef} className="hidden" />

      {photo ? (
        <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 shadow bg-white p-2">
          <img src={photo} alt="Selfie Preview" className="w-full rounded-lg object-cover aspect-video" />
          <input type="hidden" name="selfieBase64" value={photo} />
          <div className="mt-2 flex items-center justify-between px-2">
            <span className="flex items-center gap-1 text-xs font-bold text-teal-600">
              <CheckCircle2 size={14} /> Foto Terambil
            </span>
            <button 
              type="button" 
              onClick={retake}
              className="text-xs font-bold text-slate-500 hover:text-teal-700 flex items-center gap-1"
            >
              <RefreshCw size={12} /> Ambil Ulang
            </button>
          </div>
        </div>
      ) : cameraActive ? (
        <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-slate-900 bg-black p-2">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full rounded-lg scale-x-[-1] aspect-video object-cover" 
          />
          <button 
            type="button" 
            onClick={takePhoto}
            className="mt-3 button-primary w-full flex items-center justify-center gap-2"
          >
            <Camera size={16} /> Tangkap Foto
          </button>
        </div>
      ) : (
        <button 
          type="button" 
          onClick={startCamera}
          className="button-secondary w-full max-w-sm flex items-center justify-center gap-2 border-dashed border-2 py-6"
        >
          <Camera size={24} className="text-teal-600" />
          <span className="font-bold text-slate-700">Aktifkan Kamera Selfie *</span>
        </button>
      )}

      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
