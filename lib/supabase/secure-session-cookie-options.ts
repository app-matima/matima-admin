import type { CookieOptions } from "@supabase/ssr";

/**
 * Options de cookie de session sans SameSite=None.
 * On ne reprend jamais `sameSite` / `domain` de Supabase : Lax + path `/` uniquement.
 */
export function secureSessionCookieOptions(
  options?: CookieOptions,
): CookieOptions {
  return {
    path: "/",
    sameSite: "lax",
    httpOnly: options?.httpOnly,
    maxAge: options?.maxAge,
    expires: options?.expires,
    secure: options?.secure,
  };
}
