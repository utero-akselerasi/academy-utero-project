import { approveApplicationOnboardingAction, updateApplicationStatusAction } from "@/features/admin/actions";
import { Check, FileCheck, ShieldCheck, X } from "lucide-react";

type Props = {
  id: string;
  status: string;
  onboardingStatus: string | null;
  convertedInternId: string | null;
};

const actions = [
  {
    label: "Review",
    status: "reviewed",
    icon: FileCheck,
  },
  {
    label: "Terima",
    status: "accepted",
    icon: Check,
  },
  {
    label: "Tolak",
    status: "rejected",
    icon: X,
  },
] as const;

export function ApplicationStatusForm({ id, status, onboardingStatus, convertedInternId }: Props) {
  const applicationClosed = ["accepted", "converted", "rejected", "cancelled"].includes(status);
  const canApproveOnboarding = status === "accepted" && Boolean(convertedInternId) &&
    ["accepted_pending_onboarding", "biodata_review", "onboarding_complete"].includes(onboardingStatus ?? "");
  return (
    <div className="flex max-w-md flex-wrap gap-2">
      {!applicationClosed ? actions.map((item) => {
        const Icon = item.icon;

        return (
          <form action={updateApplicationStatusAction} className="flex flex-wrap gap-2" key={item.status}>
            <input name="id" type="hidden" value={id} />
            <input name="status" type="hidden" value={item.status} />
            {item.status === "accepted" ? <><input aria-label="Tanggal mulai resmi" className="form-input text-sm" name="startDate" type="date" required /><input aria-label="Tanggal selesai resmi" className="form-input text-sm" name="endDate" type="date" required /></> : null}
            <button className="button-secondary text-sm" type="submit">
              <Icon size={16} />
              {item.label}
            </button>
          </form>
        );
      }) : null}
      {canApproveOnboarding ? (
        <form action={approveApplicationOnboardingAction}>
          <input name="id" type="hidden" value={id} />
          <button className="button-primary text-sm" type="submit">
            <ShieldCheck size={16} />
            Setujui onboarding
          </button>
        </form>
      ) : null}
    </div>
  );
}

