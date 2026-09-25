"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { User, UserRole } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** Re-reads the session cookie and profile. Resolves to the user that was
   *  found (or null), so callers that just signed in through a Server Action
   *  can tell whether the browser can actually see the session yet. */
  refresh: () => Promise<User | null>;
  hasRole: (role: UserRole) => boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refresh: async () => null,
  hasRole: () => false,
  isAuthenticated: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async (): Promise<User | null> => {
    try {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        setUser(null);
        return null;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (error || !profile) {
        setUser(null);
        return null;
      }

      const next: User = {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        password: "",
        role: profile.role.toUpperCase() as UserRole,
        institutionId: profile.institution_id,
        avatar: profile.avatar,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      };
      setUser(next);
      return next;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // Initial fetch
    fetchUser().finally(() => setLoading(false));

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
          await fetchUser();
        } else if (event === "SIGNED_OUT") {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchUser]);

  // Server Actions (loginWithLockout, loginStudent, ...) write the session
  // cookie on the server response. The browser Supabase client never hears
  // about that — no SIGNED_IN event, no storage event — so a sign-in that
  // happens inside an action leaves this context reporting `user: null`
  // until something reads the cookie again. Re-read it whenever the route
  // changes while signed out; signed-in users never pay for the round trip.
  const pathname = usePathname();
  const checkedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return; // the mount fetch is still running
    if (user) {
      checkedPathRef.current = pathname;
      return;
    }
    // First pass after the mount fetch: that fetch already covered this route.
    if (checkedPathRef.current === null) {
      checkedPathRef.current = pathname;
      return;
    }
    if (checkedPathRef.current === pathname) return; // already re-checked here

    checkedPathRef.current = pathname;
    void fetchUser();
  }, [pathname, user, loading, fetchUser]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await fetchUser();
    setLoading(false);
    return next;
  }, [fetchUser]);

  const hasRole = useCallback(
    (role: UserRole) => user?.role === role,
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refresh,
        hasRole,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
