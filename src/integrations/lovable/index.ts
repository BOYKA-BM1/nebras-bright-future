// Safe wrapper — missing cloud-auth package must not crash the app shell.
import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

type OAuthResult = {
  redirected?: boolean;
  error?: unknown;
  tokens?: { access_token: string; refresh_token: string };
};

async function signInWithOAuth(
  provider: "google" | "apple" | "microsoft" | "lovable",
  opts?: SignInOptions,
): Promise<OAuthResult> {
  try {
    const mod = await import("@lovable.dev/cloud-auth-js");
    const lovableAuth = mod.createLovableAuth();
    const result = await lovableAuth.signInWithOAuth(provider, {
      ...opts,
      extraParams: { ...opts?.extraParams },
    });
    if (result.redirected || result.error) return result;
    try {
      await supabase.auth.setSession(result.tokens);
    } catch (e) {
      return { error: e instanceof Error ? e : new Error(String(e)) };
    }
    return result;
  } catch (e) {
    // Fallback: native Supabase OAuth if Lovable cloud auth is unavailable
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider === "lovable" ? "google" : provider,
        options: {
          redirectTo: opts?.redirect_uri || (typeof window !== "undefined" ? window.location.origin : undefined),
        },
      });
      if (error) return { error };
      if (data?.url) {
        window.location.href = data.url;
        return { redirected: true };
      }
      return { error: new Error("OAuth unavailable") };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}

export const lovable = {
  auth: {
    signInWithOAuth,
  },
};
