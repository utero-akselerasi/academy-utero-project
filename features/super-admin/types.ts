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

