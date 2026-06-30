import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  console.log('URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('SERVICE_KEY:', !!process.env.SUPABASE_SERVICE_KEY);
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_KEY est requis.");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
