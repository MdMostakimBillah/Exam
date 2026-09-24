-- 0019: institutions.name_en — English name alongside the Bangla name.
--
-- Registration collects BOTH "নাম (বাংলা)" and "Name (English)", but only the
-- Bangla name was persisted (the English one was used solely for the slug and
-- the admin profile display name). Settings → Profile now lets the institution
-- edit both, so store the English name too.
--
-- `name` keeps holding the primary (Bangla for registered institutions) name;
-- `name_en` is nullable and falls back to `name` wherever English is displayed.

ALTER TABLE institutions ADD COLUMN IF NOT EXISTS name_en TEXT;
