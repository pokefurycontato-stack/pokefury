-- Fix: Allow admin to donate currencies to any character
-- Run this in Supabase SQL Editor

-- Admin bypass for character_currencies
CREATE POLICY "Admin can manage all currencies"
ON character_currencies FOR ALL
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
