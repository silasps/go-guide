-- Fix circular RLS recursion between profiles and partners policies.
-- profiles_public_read checked partners → partners_owner_all checked profiles → infinite loop.
-- Solution: remove the partners check from profiles_public_read.
-- Partners accessing private profiles will be handled in Phase 2 via a SECURITY DEFINER function.

DROP POLICY IF EXISTS "profiles_public_read" ON profiles;

CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT USING (
    privacy_mode = 'public'
    OR auth.uid() = user_id
  );

-- Fix partners_owner_all to avoid re-querying profiles under RLS.
-- Store ownership check via a SECURITY DEFINER helper to break the cycle.
DROP POLICY IF EXISTS "partners_owner_all" ON partners;

CREATE OR REPLACE FUNCTION is_profile_owner(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_profile_id
      AND user_id = auth.uid()
  );
$$;

CREATE POLICY "partners_owner_all" ON partners
  FOR ALL USING (is_profile_owner(profile_id));
