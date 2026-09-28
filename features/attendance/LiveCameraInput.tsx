"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, CheckCircle2 } from "lucide-react";

export function LiveCameraInput() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * Stream disimpan di ref, BUKAN hanya di state.
   *
   * Pembersihan saat unmount harus jalan tepat sekali, jadi effect-nya
   * berdependensi `[]` — dan closure dengan dependensi kosong membekukan nilai
   * `stream` dari render pertama, yaitu `null`. Artinya versi "benar" yang
   * memakai state akan memanggil `stop()` pada null dan kamera tetap menyala.
   *
   * State `cameraActive` tetap ada untuk merender, tapi yang dimatikan selalu
   * yang ada di ref.
   */
  const streamRef = useRef<MediaStream | null>(null);

  /**
   * Apakah komponen masih terpasang. Dibutuhkan karena `getUserMedia` adalah
   * await: user bisa menekan tombol kamera lalu berpindah halaman sebelum izin
   * diberikan. Stream-nya tetap datang — SETELAH unmount — jadi tidak ada
   * effect cleanup yang bisa menjangkaunya, dan lampu kamera tetap menyala
   * sampai tab ditutup. Itu bukan kebocoran memori, itu kamera yang merekam
   * saat tidak ada yang memintanya.
   */
  const mountedRef = useRef(true);

  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const stopStream = useCallback(() => {
    const current = streamRef.current;
    if (current) {
      current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Pembersihan saat unmount (M-4). Tanpa ini, berpindah halaman selagi kamera
  // aktif meninggalkan track video hidup: lampu kamera terus menyala dan
  // perangkat tetap terpakai, dan satu-satunya cara mematikannya adalah menutup
  // tab. Formulir check-in dan check-out keduanya merender komponen ini, jadi
  // setiap kali peserta membuka lalu meninggalkan salah satunya tanpa mengambil
  // foto, satu stream tertinggal.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopStream();
    };
  }, [stopStream]);

  const startCamera = async () => {
    // Penjaga klik ganda. Tanpa ini, dua ketukan cepat menjalankan dua
    // `getUserMedia`; yang kedua menimpa `streamRef` dan yang pertama tidak
    // pernah dihentikan oleh siapa pun.
    if (starting || streamRef.current) return;

    setError("");
    setStarting(true);

    let mediaStream: MediaStream;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
    } catch (err) {
      console.error("Gagal mengakses kamera:", err);
      if (mountedRef.current) {
        setError("Gagal mengakses kamera. Pastikan izin kamera diberikan.");
        setCameraActive(false);
        setStarting(false);
      }
      return;
    }

    // Izin diberikan setelah komponen dilepas. Hentikan langsung dan jangan
    // sentuh state — setState setelah unmount tidak melakukan apa pun, tapi
    // stream-nya nyata dan harus dimatikan di sini karena tidak ada cleanup
    // lain yang akan berjalan.
    if (!mountedRef.current) {
      mediaStream.getTracks().forEach((track) => track.stop());
      return;
    }

    streamRef.current = mediaStream;
    setCameraActive(true);
    setStarting(false);
  };

  // `srcObject` dipasang di effect, bukan di dalam `startCamera`. Di sana
  // `videoRef.current` masih bisa null: elemen `<video>` hanya dirender ketika
  // `cameraActive` true, dan render itu belum terjadi saat `startCamera`
  // menetapkannya. Penugasan yang terlewat muncul sebagai kotak hitam tanpa
  // error apa pun.
  useEffect(() => {
    const video = videoRef.current;
    if (cameraActive && video && streamRef.current) {
      video.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  const stopCamera = useCallback(() => {
    stopStream();
    setCameraActive(false);
  }, [stopStream]);

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Frame pertama belum tentu siap. Versi sebelumnya jatuh ke `640 x 480`
    // saat `videoWidth` masih 0, dan `drawImage` dari video yang belum punya
    // frame menghasilkan kanvas KOSONG — selfie hitam yang tersimpan sebagai
    // bukti absensi tanpa satu pun peringatan. Lebih baik minta ulang.
    if (!video.videoWidth || !video.videoHeight) {
      setError("Kamera belum siap. Tunggu gambar muncul, lalu tangkap ulang.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    setError("");
    setPhoto(canvas.toDataURL("image/jpeg", 0.85));
    stopCamera();
  };

  const retake = () => {
    setPhoto(null);
    // Stream sudah dihentikan `takePhoto`, tapi dihentikan lagi supaya
    // `startCamera` tidak tertolak penjaga `streamRef.current` di atas kalau
    // jalur lain pernah meninggalkannya hidup.
    stopStream();
    void startCamera();
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
            muted
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
          disabled={starting}
          className="button-secondary w-full max-w-sm flex items-center justify-center gap-2 border-dashed border-2 py-6 disabled:opacity-60"
        >
          <Camera size={24} className="text-teal-600" />
          <span className="font-bold text-slate-700">
            {starting ? "Menunggu izin kamera..." : "Aktifkan Kamera Selfie *"}
          </span>
        </button>
      )}

      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
