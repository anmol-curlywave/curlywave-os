import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, type Profile } from "./supabase";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  profileError: string | null;
  loading: boolean;
  /** True after the user arrives from a password-reset email: they must set a new password. */
  recovery: boolean;
  clearRecovery: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(() => window.location.hash.includes("type=recovery"));
  const lastUid = useRef<string | undefined>(undefined);

  async function loadProfile(uid: string | undefined, force = false) {
    if (!uid) { lastUid.current = undefined; setProfile(null); setProfileError(null); return; }
    if (!force && uid === lastUid.current) return;
    lastUid.current = uid;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (error || !data) {
      lastUid.current = undefined;
      setProfile(null);
      setProfileError(error?.message ?? "Your profile could not be found.");
    } else {
      setProfile(data as Profile);
      setProfileError(null);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(s);
      // Defer the query so it doesn't run inside the auth callback.
      setTimeout(() => loadProfile(s?.user.id), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    session, profile, profileError, loading, recovery,
    clearRecovery: () => { setRecovery(false); history.replaceState(null, "", window.location.pathname + window.location.search); },
    refreshProfile: () => loadProfile(session?.user.id, true),
    signOut: async () => {
      await supabase.auth.signOut();
      lastUid.current = undefined;
      setProfile(null);
      setProfileError(null);
      setRecovery(false);
    },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
