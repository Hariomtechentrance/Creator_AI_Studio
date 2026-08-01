import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Create a Supabase server client.
 * If `useServiceRole` is true and `SUPABASE_SERVICE_ROLE_KEY` is set, the server
 * client will be created with the service role key for admin operations.
 */
export async function createClient(useServiceRole = false) {
  const cookieStore = await cookies();
  const key = useServiceRole
    ? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            const defaultSameSite = (process.env.COOKIE_SAMESITE as
              | 'lax'
              | 'strict'
              | 'none') || 'lax';
            const defaultSecure = process.env.NODE_ENV === 'production';
            const defaultDomain = process.env.COOKIE_DOMAIN;

            cookiesToSet.forEach(({ name, value, options }) => {
              const enforced: {
                secure?: boolean;
                httpOnly?: boolean;
                sameSite?: 'lax' | 'strict' | 'none';
                path?: string;
                domain?: string;
                [key: string]: unknown;
              } = {
                ...(options as Record<string, unknown>),
                secure: options?.secure ?? defaultSecure,
                httpOnly: options?.httpOnly ?? true,
                sameSite: (options?.sameSite as 'lax' | 'strict' | 'none') ?? defaultSameSite,
                path: options?.path ?? '/',
              };
              if (defaultDomain) enforced.domain = defaultDomain;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              cookieStore.set(name, value, enforced as any);
            });
          } catch {}
        },
      },
    },
  );
}
