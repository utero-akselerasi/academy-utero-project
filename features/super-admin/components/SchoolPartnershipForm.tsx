"use client";

import { useActionState } from "react";
import { updateSchoolPartnershipAction, type SchoolPartnershipState } from "@/features/super-admin/actions";

const initialState: SchoolPartnershipState = { ok: false, message: "" };

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
    <form action={action} className="mt-5 grid gap-2 border-t border-slate-200 pt-4">
      <input type="hidden" name="schoolId" value={school.id} />
      <label className="text-sm font-semibold">Status kemitraan
        <select className="form-input" name="partnerStatus" defaultValue={school.partner_status}>
          {["prospect", "verified", "active_partner", "suspended", "ended"].map((status) => <option value={status} key={status}>{status}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold">Kode sekolah
        <input className="form-input uppercase" name="referralCode" defaultValue={school.referral_code ?? ""} placeholder="KODE-SEKOLAH" pattern="[A-Za-z0-9-]{6,32}" minLength={6} maxLength={32} title="Gunakan 6-32 huruf, angka, atau tanda hubung." />
      </label>
      <label className="text-sm font-semibold">Kuota kode (opsional)
        <input className="form-input" name="referralQuota" type="number" min={1} max={100000} defaultValue={school.referral_quota ?? ""} />
      </label>
      <label className="text-sm font-semibold">Kode berlaku sampai
        <input className="form-input" name="referralExpiresAt" type="date" defaultValue={school.referral_expires_at?.slice(0, 10) ?? ""} />
      </label>
      {state.message && <p role="status" className={"text-sm font-semibold " + (state.ok ? "text-teal-700" : "text-red-700")}>{state.message}</p>}
      <button className="button-secondary" disabled={pending} type="submit">{pending ? "Menyimpan..." : "Simpan Kemitraan"}</button>
    </form>
  );
}
