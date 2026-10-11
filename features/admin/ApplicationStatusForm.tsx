import { updateApplicationStatusAction } from "@/features/admin/actions";
import { Check, FileCheck, X } from "lucide-react";

type Props = {
  id: string;
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

export function ApplicationStatusForm({ id }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((item) => {
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
      })}
    </div>
  );
}

