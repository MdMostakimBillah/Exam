-- Add registration_number to registrations table
-- Format: 10 digits — YYYYNNNNNN (e.g., 2026000001)
-- Global sequential number across all institutions

-- Add the column (nullable first for backfill)
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registration_number TEXT;

-- Backfill existing registrations using their application_id
UPDATE registrations SET registration_number = application_id WHERE registration_number IS NULL;

-- Add unique constraint
ALTER TABLE registrations ADD CONSTRAINT registrations_number_unique UNIQUE (registration_number);

-- Make NOT NULL after backfill
ALTER TABLE registrations ALTER COLUMN registration_number SET NOT NULL;
