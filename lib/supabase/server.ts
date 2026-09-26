import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { assertSupabaseEnv } from "./config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = assertSupabaseEnv();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component tidak selalu boleh menulis cookie.
        }
      },
    },
  });
}

export async function createUteroAcademyClient() {
  const supabase = await createSupabaseServerClient();

  return supabase.schema("utero_academy");
}


export function createSupabaseServiceRoleClient() {
  const { supabaseUrl } = assertSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function createUteroAcademyServiceRoleClient() {
  const supabase = createSupabaseServiceRoleClient();
  return supabase.schema("utero_academy");
}
