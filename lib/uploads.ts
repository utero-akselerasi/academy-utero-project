import { randomUUID } from "node:crypto";

/**
 * Validasi berkas terpusat untuk semua upload ke Supabase Storage.
 *
 * Masalah yang diperbaiki di seluruh call site sebelumnya:
 * - Ekstensi diambil dari `file.name` milik klien, jadi penyerang bisa
 *   mengunggah ".html" / ".svg" ke bucket publik dan mendapat stored XSS.
 * - `contentType` diambil dari `file.type` milik klien, jadi tipe MIME bisa
 *   dipalsukan sepenuhnya.
 * - Tidak ada batas ukuran, jadi satu request bisa mengisi storage.
 * - Nama berkas memakai `Date.now()` + `upsert: true`, jadi dua upload pada
 *   milidetik yang sama saling menimpa.
 *
 * Kebijakan di sini: tipe berkas ditentukan dari magic byte (isi berkas),
 * bukan dari apa pun yang dikirim klien; nama berkas dibuat server.
 */

export type UploadKind = "image" | "document";

/** Batas ukuran per jenis berkas. */
export const UPLOAD_SIZE_LIMITS: Record<UploadKind, number> = {
  image: 5 * 1024 * 1024, // 5 MB
  document: 10 * 1024 * 1024, // 10 MB
};

type Signature = {
  mime: string;
  ext: string;
  kind: UploadKind;
  /** Offset awal pencocokan magic byte. */
  offset: number;
  bytes: number[];
};

/**
 * Hanya format yang dirender aman oleh browser sebagai konten pasif.
 * SVG sengaja TIDAK diizinkan: SVG bisa memuat <script> dan bucket ini publik.
 */
const SIGNATURES: Signature[] = [
  { mime: "image/jpeg", ext: "jpg", kind: "image", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", ext: "png", kind: "image", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/gif", ext: "gif", kind: "image", offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "application/pdf", ext: "pdf", kind: "document", offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
];

/** WEBP = "RIFF" di offset 0 dan "WEBP" di offset 8. */
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

/** ZIP container; dipakai DOCX/XLSX/PPTX (OOXML). */
const ZIP_MAGICS = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
];

function matches(buffer: Uint8Array, offset: number, bytes: number[]) {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

export type DetectedFileType = {
  mime: string;
  ext: string;
  kind: UploadKind;
};

/** Menentukan tipe berkas dari isinya. Mengembalikan null bila tidak dikenal. */
export function detectFileType(buffer: Uint8Array): DetectedFileType | null {
  for (const signature of SIGNATURES) {
    if (matches(buffer, signature.offset, signature.bytes)) {
      return { mime: signature.mime, ext: signature.ext, kind: signature.kind };
    }
  }

  if (matches(buffer, 0, RIFF) && matches(buffer, 8, WEBP)) {
    return { mime: "image/webp", ext: "webp", kind: "image" };
  }

  if (ZIP_MAGICS.some((magic) => matches(buffer, 0, magic))) {
    // Tidak membuka isi ZIP; cukup ditandai sebagai dokumen OOXML generik.
    return {
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ext: "docx",
      kind: "document",
    };
  }

  return null;
}

export type ValidatedUpload = {
  buffer: Uint8Array;
  /** MIME hasil deteksi isi berkas, aman dipakai sebagai contentType. */
  contentType: string;
  /** Ekstensi hasil deteksi, bukan dari nama berkas klien. */
  ext: string;
  kind: UploadKind;
  size: number;
  /** Nama asli dari klien; hanya untuk ditampilkan, sudah dibersihkan. */
  displayName: string;
};

export class UploadValidationError extends Error {}

/** Membersihkan nama berkas agar aman ditampilkan dan tidak berisi path. */
export function sanitizeDisplayName(name: string, fallback: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, 120);
}

/**
 * Memvalidasi satu berkas upload.
 *
 * @param file Berkas dari FormData.
 * @param allowedKinds Jenis berkas yang boleh diterima call site ini.
 * @throws UploadValidationError dengan pesan siap tampil ke user.
 */
export async function validateUpload(
  file: File,
  allowedKinds: UploadKind[] = ["image"],
): Promise<ValidatedUpload> {
  if (!file || file.size === 0) {
    throw new UploadValidationError("Berkas kosong atau tidak terbaca.");
  }

  const maxSize = Math.max(...allowedKinds.map((kind) => UPLOAD_SIZE_LIMITS[kind]));
  if (file.size > maxSize) {
    throw new UploadValidationError(
      `Ukuran berkas melebihi batas ${Math.floor(maxSize / (1024 * 1024))} MB.`,
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());

  // Ukuran dicek ulang dari buffer: file.size berasal dari klien.
  if (buffer.byteLength > maxSize) {
    throw new UploadValidationError(
      `Ukuran berkas melebihi batas ${Math.floor(maxSize / (1024 * 1024))} MB.`,
    );
  }

  const detected = detectFileType(buffer);
  if (!detected) {
    throw new UploadValidationError("Format berkas tidak didukung.");
  }

  if (!allowedKinds.includes(detected.kind)) {
    throw new UploadValidationError("Jenis berkas tidak diizinkan untuk unggahan ini.");
  }

  if (buffer.byteLength > UPLOAD_SIZE_LIMITS[detected.kind]) {
    throw new UploadValidationError(
      `Ukuran berkas melebihi batas ${Math.floor(UPLOAD_SIZE_LIMITS[detected.kind] / (1024 * 1024))} MB.`,
    );
  }

  return {
    buffer,
    contentType: detected.mime,
    ext: detected.ext,
    kind: detected.kind,
    size: buffer.byteLength,
    displayName: sanitizeDisplayName(file.name, `berkas.${detected.ext}`),
  };
}

/**
 * Memvalidasi gambar yang dikirim sebagai data URL base64 (mis. selfie kamera).
 * Prefix "data:image/..." dari klien diabaikan sepenuhnya; tipe ditentukan dari
 * hasil dekode base64, dan ukurannya dibatasi seperti upload biasa.
 */
export function validateBase64Image(dataUrl: string): ValidatedUpload {
  const base64 = dataUrl.includes(";base64,") ? dataUrl.split(";base64,").pop() : dataUrl;
  if (!base64) {
    throw new UploadValidationError("Data gambar tidak valid.");
  }

  let buffer: Uint8Array;
  try {
    buffer = new Uint8Array(Buffer.from(base64, "base64"));
  } catch {
    throw new UploadValidationError("Data gambar tidak valid.");
  }

  if (buffer.byteLength === 0) {
    throw new UploadValidationError("Data gambar kosong.");
  }
  if (buffer.byteLength > UPLOAD_SIZE_LIMITS.image) {
    throw new UploadValidationError(
      `Ukuran gambar melebihi batas ${Math.floor(UPLOAD_SIZE_LIMITS.image / (1024 * 1024))} MB.`,
    );
  }

  const detected = detectFileType(buffer);
  if (!detected || detected.kind !== "image") {
    throw new UploadValidationError("Format gambar tidak didukung.");
  }

  return {
    buffer,
    contentType: detected.mime,
    ext: detected.ext,
    kind: detected.kind,
    size: buffer.byteLength,
    displayName: `gambar.${detected.ext}`,
  };
}

/**
 * Membuat path objek storage yang unik dan tidak bisa ditebak.
 * Memakai UUID, bukan Date.now(), agar dua upload bersamaan tidak bertabrakan
 * dan pemanggil tidak perlu lagi memakai upsert: true.
 *
 * **Ini satu-satunya penghasil object path di seluruh aplikasi** — ke-16 titik
 * unggah memanggilnya. Karena itu ia juga tempat yang benar untuk menolak
 * traversal, dan bukan cuma di titik panggil masing-masing.
 *
 * Pemangkasan lamanya `prefix.replace(/^\/+|\/+$/g, "")` hanya membuang slash di
 * **ujung**. `../` di tengah lolos utuh, jadi `prefix` yang isinya berasal dari
 * `formData` bisa memindahkan unggahan ke prefix lain — termasuk lintas jalur
 * dalam bucket campur `avatars`, tempat CV, selfie, dan surat sakit berdampingan.
 *
 * Melempar, bukan membersihkan diam-diam: kalau segmen dibuang tanpa suara,
 * pemanggil menyimpan path yang berbeda dari yang ia yakini dan objeknya jadi
 * tak terjangkau. Semua pemanggil sah memberi prefix yang tetap atau berasal
 * dari UUID baris DB, jadi lemparan di sini berarti cacat kode atau serangan —
 * dua hal yang memang harus berhenti keras.
 */
export function buildStoragePath(prefix: string, ext: string): string {
  if (typeof prefix !== "string") {
    throw new Error("Prefix path storage tidak valid.");
  }

  // Slash ANTAR segmen memang sah — `lessons/<id>`, `<userId>/attendance_in`,
  // `assignment/<id>/<internId>` semuanya bentuk yang dipakai. Yang tidak sah
  // adalah isi segmennya, jadi pemeriksaannya per segmen, bukan atas seluruh
  // string.
  const segmen = prefix.split("/").filter((s) => s !== "");

  for (const s of segmen) {
    // `.` dan `..` adalah traversal. Backslash karena Supabase memperlakukannya
    // sebagai karakter biasa sementara sebagian alat tidak — beda tafsir itu
    // sendiri sudah cukup alasan menolak. Karakter kendali (termasuk NUL dan
    // newline) karena ia bisa memotong path di lapisan yang tidak menyangkanya.
    if (s === "." || s === "..") {
      throw new Error("Prefix path storage tidak valid.");
    }
    if (s.includes("\\") || /[\u0000-\u001f\u007f]/.test(s)) {
      throw new Error("Prefix path storage tidak valid.");
    }
    if (s.trim() !== s) {
      throw new Error("Prefix path storage tidak valid.");
    }
  }

  // `ext` selalu berasal dari `detectFileType()` (deteksi isi berkas, bukan nama
  // dari klien), jadi pemeriksaan ini tak seharusnya kena. Ada supaya pemanggil
  // baru yang menyusupkan ekstensi dari klien berhenti di sini.
  if (!/^[a-z0-9]+$/.test(ext)) {
    throw new Error("Ekstensi berkas tidak valid.");
  }

  const cleanPrefix = segmen.join("/");
  const name = `${randomUUID()}.${ext}`;
  return cleanPrefix ? `${cleanPrefix}/${name}` : name;
}
