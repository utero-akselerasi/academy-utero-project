export type AttendanceStatus = "pending" | "valid" | "invalid" | "manual_review";

export type Attendance = {
  id: string;
  intern_id: string;
  attendance_date: string;
  check_in_at: string | null;
  check_in_deadline_minutes?: number | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_in_selfie_path: string | null;
  check_in_wifi_ssid: string | null;
  check_out_at: string | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_out_selfie_path: string | null;
  check_out_wifi_ssid: string | null;
  check_out_is_out_of_range?: boolean;
  check_out_out_of_range_reason?: string | null;
  check_out_out_of_range_proof_path?: string | null;
  status: AttendanceStatus;
  attendance_type?: "present" | "permit" | "sick";
  permit_reason?: string | null;
  sick_certificate_path?: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceWithIntern = Attendance & {
  intern_profiles: {
    id: string;
    full_name: string;
  } | null;
};

export type PermitStatus = "pending" | "approved" | "rejected";

export type Permit = {
  id: string;
  intern_id: string;
  permit_type: "permit" | "sick";
  start_date: string;
  end_date: string;
  reason: string;
  attachment_path: string | null;
  status: PermitStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};
