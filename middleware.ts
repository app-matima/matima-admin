import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isPrestataireRestrictedPath, PRESTATAIRE_HOME_PATH } from "@/lib/navigation/admin-nav-items";
import type { AdminRole } from "@/types/admin";

const PUBLIC_AUTH_ROUTES = ["/auth/login", "/auth/accept-invite"];

const PUBLIC_API_ROUTES = ["/api/reset-password"];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_AUTH_ROUTES.includes(pathname)) {
    return true;
  }

  return PUBLIC_API_ROUTES.includes(pathname);
}

async function getAdminUserRole(userId: string): Promise<AdminRole | null> {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!serviceKey) {
    return null;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const { data, error } = await supabase
    .from("admin_users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data?.role) {
    return null;
  }

  return data.role as AdminRole;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublic = isPublicRoute(pathname);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const role = await getAdminUserRole(user.id);

    if (pathname === "/auth/login") {
      const url = request.nextUrl.clone();
      url.pathname = role === "prestataire" ? PRESTATAIRE_HOME_PATH : "/dashboard";
      return NextResponse.redirect(url);
    }

    if (role === "prestataire" && isPrestataireRestrictedPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = PRESTATAIRE_HOME_PATH;
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
