-- Add Bangla name columns to students table
-- Supports storing Bangla (বাংলা) first and last names alongside English names

ALTER TABLE students ADD COLUMN IF NOT EXISTS first_name_bn TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_name_bn TEXT;
