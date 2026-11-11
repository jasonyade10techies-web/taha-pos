import { apiAuth } from "../../../lib/api/client";
import { apiEnabled } from "../../../lib/config";
import { isTauri } from "@tauri-apps/api/core";
import { requireSupabase } from "../../../lib/supabase/client";
import { googleEnabled, supabaseUrl } from "../../../lib/config";

export const authService = {
  signIn: async (email: string, password: string) => {
    if (apiEnabled) { await apiAuth.login(email, password); return; }
    const { error } = await requireSupabase().auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  },
  signOut: async () => {
    if (apiEnabled) { await apiAuth.logout(); return; }
    const { error } = await requireSupabase().auth.signOut({ scope: "local" });
    if (error) {
      localStorage.removeItem("taha-pos-auth");
      throw error;
    }
  },
  changePassword: async (currentPassword: string, password: string) => {
    if (apiEnabled) { await apiAuth.changePassword(currentPassword, password); return; }
    const { error } = await requireSupabase().auth.updateUser({ current_password: currentPassword, password });
    if (error) throw error;
  },
  signInWithGoogle: async () => {
    if (!googleEnabled)
      throw new Error("Google sign-in has not been enabled by management.");
    const native = isTauri();
    const { data, error } = await requireSupabase().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: native
          ? "taha-pos://auth/callback"
          : `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: native,
      },
    });
    if (error) throw error;
    if (native && data.url) {
      const destination = new URL(data.url);
      if (
        destination.origin !== new URL(supabaseUrl).origin ||
        destination.pathname !== "/auth/v1/authorize"
      )
        throw new Error("Unexpected authorization destination.");
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(data.url);
    }
  },
  exchangeNativeCode: async (rawUrl: string) => {
    const url = new URL(rawUrl);
    if (
      url.protocol !== "taha-pos:" ||
      url.hostname !== "auth" ||
      url.pathname !== "/callback"
    )
      return;
    const code = url.searchParams.get("code");
    if (!code || url.searchParams.has("error"))
      throw new Error("Google authorization was not completed.");
    const { error } = await requireSupabase().auth.exchangeCodeForSession(code);
    if (error) throw error;
  },
};
