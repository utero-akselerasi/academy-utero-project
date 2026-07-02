export type AttendanceStatus = "pending" | "valid" | "invalid" | "manual_review";

export type Attendance = {
  id: string;
  intern_id: string;
  attendance_date: string;
  check_in_at: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_in_selfie_path: string | null;
  check_in_wifi_ssid: string | null;
  check_out_at: string | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_out_selfie_path: string | null;
  check_out_wifi_ssid: string | null;
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
