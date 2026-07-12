import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // Skip auth when Supabase is not yet configured (allows UI preview)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthPage = request.nextUrl.pathname.startsWith("/auth");
  const isPublicPage = request.nextUrl.pathname.startsWith("/lp/");
  const isDashboard = !isAuthPage && !isPublicPage && !request.nextUrl.pathname.startsWith("/api");

  if (!user && isDashboard && request.nextUrl.pathname !== "/") {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // A/B variant assignment for public landing pages. Server Components can't
  // set response cookies during render, so a sticky per-visitor variant has
  // to be assigned here (where NextResponse can set cookies) and handed to
  // the page via a request header instead of the page reading cookies itself.
  if (isPublicPage) {
    const slug = request.nextUrl.pathname.split("/lp/")[1]?.split("/")[0];
    if (slug) {
      const cookieName = `lp_variant_${slug}`;
      const existing = request.cookies.get(cookieName)?.value;
      const variant = existing === "a" || existing === "b" ? existing : Math.random() < 0.5 ? "b" : "a";

      const headers = new Headers(request.headers);
      headers.set("x-lp-variant", variant);
      const response = NextResponse.next({ request: { headers } });
      if (!existing) {
        response.cookies.set(cookieName, variant, { path: "/", maxAge: 31536000, sameSite: "lax" });
      }
      return response;
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
