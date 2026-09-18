"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, UserRole } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
  hasRole: () => false,
  isAuthenticated: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        setUser(null);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (error || !profile) {
        setUser(null);
        return;
      }

      setUser({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        password: "",
        role: profile.role.toUpperCase() as UserRole,
        institutionId: profile.institution_id,
        avatar: profile.avatar,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      });
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // Initial fetch
    fetchUser().finally(() => setLoading(false));

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
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

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchUser();
    setLoading(false);
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
