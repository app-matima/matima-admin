import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { secureSessionCookieOptions } from "@/lib/supabase/secure-session-cookie-options";

export async function createAuthServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const secureOptions = secureSessionCookieOptions(options);
              cookieStore.set({
                name,
                value,
                path: secureOptions.path ?? "/",
                sameSite: "lax",
                httpOnly: secureOptions.httpOnly,
                maxAge: secureOptions.maxAge,
                expires: secureOptions.expires,
                secure: secureOptions.secure,
              });
            });
          } catch {
            // setAll appelé depuis un Server Component (lecture seule).
          }
        },
      },
    },
  );
}
