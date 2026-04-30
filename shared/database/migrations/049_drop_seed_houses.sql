-- Migration 049: drop seed houses left over from migration 037.
-- Only deletes rows that have ZERO references — if the admin started using a
-- seed (linked it to a campaign/promotion/etc), it's preserved.
-- Idempotent: safe to re-run; rows already deleted are simply skipped.

-- 1. Drop the seed default campaign on bet365 (037 also inserted this).
--    Only delete if it still has no clicks/attributions tied to it.
DELETE FROM affiliate.campaigns c
 WHERE c.slug = 'default'
   AND c.label = 'Default'
   AND c.house_id IN (
     SELECT id FROM affiliate.houses WHERE slug = 'bet365'
   )
   AND NOT EXISTS (
     SELECT 1 FROM affiliate.clicks cl WHERE cl.campaign_id = c.id
   );

-- 2. Drop unreferenced seed entries from affiliate.houses.
--    Reference checks: campaigns.house_id, campaigns.redirect_house_id,
--    campaign_houses, attributions, clicks (FK on house_id).
DELETE FROM affiliate.houses ah
 WHERE ah.slug IN ('bet365', 'sportingbet', 'betano', 'pixbet', 'esportes-da-sorte')
   AND NOT EXISTS (SELECT 1 FROM affiliate.campaigns c WHERE c.house_id = ah.id)
   AND NOT EXISTS (SELECT 1 FROM affiliate.campaigns c WHERE c.redirect_house_id = ah.id)
   AND NOT EXISTS (SELECT 1 FROM affiliate.campaign_houses ch WHERE ch.house_id = ah.id)
   AND NOT EXISTS (SELECT 1 FROM affiliate.attributions a WHERE a.house_id = ah.id)
   AND NOT EXISTS (SELECT 1 FROM affiliate.clicks cl WHERE cl.house_id = ah.id);

-- 3. Drop unreferenced seed entries from core.houses.
--    Reference checks: affiliate.houses.house_id, validation.partner_houses.house_id,
--    promotions.promotions.house_id.
DELETE FROM core.houses ch
 WHERE ch.slug IN ('bet365', 'sportingbet', 'betano', 'pixbet', 'esportes-da-sorte')
   AND NOT EXISTS (SELECT 1 FROM affiliate.houses ah WHERE ah.house_id = ch.id)
   AND NOT EXISTS (SELECT 1 FROM validation.partner_houses vp WHERE vp.house_id = ch.id)
   AND NOT EXISTS (SELECT 1 FROM promotions.promotions p WHERE p.house_id = ch.id);
