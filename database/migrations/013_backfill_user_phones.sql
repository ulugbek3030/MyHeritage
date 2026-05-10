-- 013_backfill_user_phones.sql
-- Click sometimes omits phone_number in the integration profile for
-- non-identified users on first sync, so users.phone ends up NULL even
-- though the cached profile JSON in users.click_profile does include
-- phone_number. Copy it across so phone-based lookups (e.g. the
-- «Расширить древо» request flow) find these users.

UPDATE users
SET phone = click_profile->>'phone_number'
WHERE phone IS NULL
  AND click_profile IS NOT NULL
  AND COALESCE(NULLIF(click_profile->>'phone_number', ''), '') <> '';
