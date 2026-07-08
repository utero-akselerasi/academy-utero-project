export type Role = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

export type UserProfile = {
  id: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  email?: string;
  last_sign_in_at?: string | null;
  school_name?: string | null;
};

export type UserRole = {
  id: string;
  user_id: string;
  role_id: string;
  roles: {
    code: string;
    name: string;
  } | null;
};

export type School = {
  id: string;
  name: string;
  type: string | null;
  city: string | null;
  province: string | null;
  address: string | null;
  logo_path: string | null;
  created_at: string;
  contacts_count?: number;
  interns_count?: number;
};

export type SchoolContact = {
  id: string;
  school_id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  schools?: { name: string } | { name: string }[] | null;
};

export type SchoolInternOption = {
  id: string;
  full_name: string;
  email: string | null;
  major: string | null;
  status: string;
  school_id: string | null;
  start_date: string | null;
  end_date: string | null;
  grade_or_semester: string | null;
};

export type OrphanData = {
  orphanContacts: Array<{
    id: string;
    user_id: string | null;
    school_id: string;
    name: string;
  }>;
  orphanInterns: Array<{
    id: string;
    school_id: string | null;
    full_name: string;
  }>;
  schoolContactsWithoutSchool: Array<{
    id: string;
    user_id: string | null;
    school_id: string;
    name: string;
  }>;
  total: number;
  error?: any;
};

