import { ComponentPropsWithoutRef } from "react";

/**
 * Bilah kemajuan.
 *
 * Temuan aksesibilitas #15: `role="progressbar"` tanpa nama terakses diumumkan
 * pembaca layar sebagai "progress bar, 62 persen" — angkanya ada, tapi tidak ada
 * keterangan 62 persen dari APA. Di halaman analitik ada dua bilah berdampingan
 * (rata-rata nilai kuis dan rata-rata nilai tugas), jadi keduanya terdengar
 * identik dan angkanya tidak bisa dihubungkan ke apa pun.
 *
 * `label` dijadikan **wajib**, bukan opsional. Prop opsional akan dihilangkan
 * pemanggil berikutnya dan lubangnya kembali secara senyap; prop wajib membuat
 * `tsc` yang menagihnya.
 *
 * Nilainya juga dijepit ke 0–100: `aria-valuenow` di luar rentang
 * `aria-valuemin`/`max` adalah keadaan tak sah, dan `level_progress` berasal dari
 * perhitungan di DB yang tidak dijamin ada di dalam rentang.
 */
type ProgressProps = Omit<ComponentPropsWithoutRef<"div">, "role" | "aria-label"> & {
  value?: number;
  /** Apa yang diukur bilah ini, mis. "Rata-rata nilai kuis". */
  label: string;
};

export function Progress({ value = 0, label, className, ...props }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={clamped}
      aria-label={label}
      // `aria-valuetext` memberi pembaca layar bentuk yang bisa dibaca; tanpa itu
      // sebagian pembaca mengumumkan angka mentah tanpa satuan.
      aria-valuetext={`${Math.round(clamped)} persen`}
      className={className}
      role="progressbar"
      {...props}
    />
  );
}
