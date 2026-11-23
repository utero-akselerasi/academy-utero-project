"use client";

import { useActionState } from "react";
import { updateSchoolPartnershipAction, type SchoolPartnershipState } from "@/features/super-admin/actions";

const initialState: SchoolPartnershipState = { ok: false, message: "" };

const partnershipStatuses = [
  { value: "prospect", label: "Prospek" },
  { value: "verified", label: "Terverifikasi" },
  { value: "active_partner", label: "Mitra aktif" },
  { value: "suspended", label: "Ditangguhkan" },
  { value: "ended", label: "Berakhir" },
];

type Props = {
  school: {
    id: string;
    partner_status: "prospect" | "verified" | "active_partner" | "suspended" | "ended";
    referral_code: string | null;
    referral_quota: number | null;
    referral_expires_at: string | null;
  };
};

export function SchoolPartnershipForm({ school }: Props) {
  const [state, action, pending] = useActionState(updateSchoolPartnershipAction, initialState);

  return (
    <form action={action} className="mt-3 grid gap-3">
      <input type="hidden" name="schoolId" value={school.id} />
      <label className="text-xs font-semibold text-slate-600">Status kemitraan
        <select className="form-input mt-1" name="partnerStatus" defaultValue={school.partner_status}>
          {partnershipStatuses.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-600">Kode sekolah
        <input className="form-input mt-1 uppercase" name="referralCode" defaultValue={school.referral_code ?? ""} placeholder="KODE-SEKOLAH" pattern="[A-Za-z0-9-]{6,32}" minLength={6} maxLength={32} title="Gunakan 6-32 huruf, angka, atau tanda hubung." />
      </label>
      <label className="text-xs font-semibold text-slate-600">Kuota kode (opsional)
        <input className="form-input mt-1" name="referralQuota" type="number" min={1} max={100000} defaultValue={school.referral_quota ?? ""} />
      </label>
      <label className="text-xs font-semibold text-slate-600">Kode berlaku sampai
        <input className="form-input mt-1" name="referralExpiresAt" type="date" defaultValue={school.referral_expires_at?.slice(0, 10) ?? ""} />
      </label>
      {state.message && <p role="status" className={"text-sm font-semibold " + (state.ok ? "text-teal-700" : "text-red-700")}>{state.message}</p>}
      <button className="min-h-10 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60" disabled={pending} type="submit">{pending ? "Menyimpan..." : "Simpan kemitraan"}</button>
    </form>
  );
}
