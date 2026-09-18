// Seed data is now in supabase/fix-rls.sql
// This file is kept for backward compatibility but does nothing.
// All data is now stored in Supabase and managed via React Query hooks.

export function isInitialized(): boolean {
  return true;
}

export function markInitialized(): void {
  // No-op - data is in Supabase
}

export function initializeDemoData(): void {
  // No-op - data is in Supabase
}
