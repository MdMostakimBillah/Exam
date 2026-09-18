import { User, UserRole } from "../types";
import { createClient } from "@/lib/supabase/client";

// Re-export useAuth for convenience
export { useAuth } from "./auth-provider";

// Backward-compatible sync function - returns null on initial render
// For new code, use useAuth() hook instead
export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  // Try to read from auth cookies via Supabase
  // This is a best-effort sync read for backward compatibility
  try {
    const supabase = createClient();
    // We can't do async here, so return null and let useAuth handle it
    return null;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<User | null> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Login error:", error.message);
    return null;
  }

  if (data.user) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError.message);
      return null;
    }

    return {
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
  }

  return null;
}

export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}
