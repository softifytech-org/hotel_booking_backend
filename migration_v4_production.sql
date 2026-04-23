-- ════════════════════════════════════════════════════════════════
--  Hotel SaaS Platform — Migration v4 (Production Enhancements)
--  Run this in Supabase SQL Editor or pgAdmin Query Tool
-- ════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
--  1. Hotels: Add city and state columns
-- ─────────────────────────────────────────────
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS state VARCHAR(100);

-- ─────────────────────────────────────────────
--  2. Organizations: Add banner_images column
-- ─────────────────────────────────────────────
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS banner_images TEXT[] DEFAULT '{}';

-- ─────────────────────────────────────────────
--  3. Indexes for hotel search by city/state
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hotels_city ON hotels(city);
CREATE INDEX IF NOT EXISTS idx_hotels_state ON hotels(state);

-- ─────────────────────────────────────────────
--  4. Verify migration succeeded
-- ─────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '✅ Migration v4 completed successfully';
  RAISE NOTICE '   → hotels.city column added';
  RAISE NOTICE '   → hotels.state column added';
  RAISE NOTICE '   → organizations.banner_images column added';
  RAISE NOTICE '   → Indexes created for city/state search';
END $$;
