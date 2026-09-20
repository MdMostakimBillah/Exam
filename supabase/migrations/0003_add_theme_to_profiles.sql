-- ============================================
-- Add theme preference to profiles table
-- ============================================

-- Add theme column to profiles (default: dark)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark';

-- Add a check constraint to ensure only valid theme values
ALTER TABLE profiles ADD CONSTRAINT profiles_theme_check CHECK (theme IN ('light', 'dark'));
