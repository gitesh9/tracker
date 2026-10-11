import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

type GuestSupabase = SupabaseClient<Database> | null;
type GuestClaims = Record<string, unknown> | null;

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export const optionalSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env["SUPABASE_URL"];
    const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];

    const request = getRequest();
    const authHeader = request?.headers?.get?.("authorization");

    if (
      !SUPABASE_URL ||
      !SUPABASE_PUBLISHABLE_KEY ||
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return next({
        context: {
          supabase: null as GuestSupabase,
          userId: "guest_user",
          claims: null as GuestClaims,
        },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token || token.split(".").length !== 3) {
      return next({
        context: {
          supabase: null as GuestSupabase,
          userId: "guest_user",
          claims: null as GuestClaims,
        },
      });
    }

    try {
      const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: {
          fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const { data, error } = await supabase.auth.getClaims(token);
      if (error || !data?.claims || !data.claims.sub) {
        return next({
          context: {
            supabase: null as GuestSupabase,
            userId: "guest_user",
            claims: null as GuestClaims,
          },
        });
      }

      return next({
        context: {
          supabase: supabase as GuestSupabase,
          userId: data.claims.sub,
          claims: data.claims as unknown as GuestClaims,
        },
      });
    } catch {
      return next({
        context: {
          supabase: null as GuestSupabase,
          userId: "guest_user",
          claims: null as GuestClaims,
        },
      });
    }
  },
);

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env["SUPABASE_URL"];
    const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      // In local mode without Supabase credentials, allow graceful guest context
      return next({
        context: {
          supabase: null as GuestSupabase,
          userId: "guest_user",
          claims: null as GuestClaims,
        },
      });
    }

    const request = getRequest();
    const authHeader = request?.headers?.get?.("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next({
        context: {
          supabase: null as GuestSupabase,
          userId: "guest_user",
          claims: null as GuestClaims,
        },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token || token.split(".").length !== 3) {
      return next({
        context: {
          supabase: null as GuestSupabase,
          userId: "guest_user",
          claims: null as GuestClaims,
        },
      });
    }

    try {
      const supabase = createClient<Database>(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
        global: {
          fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY!),
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const { data, error } = await supabase.auth.getClaims(token);
      if (error || !data?.claims || !data.claims.sub) {
        return next({
          context: {
            supabase: null as GuestSupabase,
            userId: "guest_user",
            claims: null as GuestClaims,
          },
        });
      }

      return next({
        context: {
          supabase: supabase as GuestSupabase,
          userId: data.claims.sub,
          claims: data.claims as unknown as GuestClaims,
        },
      });
    } catch {
      return next({
        context: {
          supabase: null as GuestSupabase,
          userId: "guest_user",
          claims: null as GuestClaims,
        },
      });
    }
  },
);
