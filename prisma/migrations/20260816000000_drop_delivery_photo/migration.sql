-- Drop the legacy deliveryPhotoUrl column. Delivery confirmation is PIN-only
-- (the photo upload endpoint, storage wiring, and bucket sweep were removed),
-- so this column is never written anymore. Kept it around for history until
-- now; dropping it keeps the DB schema in sync with the app.

-- DropColumn
ALTER TABLE "Order" DROP COLUMN IF EXISTS "deliveryPhotoUrl";
