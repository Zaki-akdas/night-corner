-- Admin-confirmed UPI advance: set when the store verifies the customer's
-- split-payment advance actually arrived (manual UPI, no gateway).
ALTER TABLE "Order" ADD COLUMN "advanceReceivedAt" TIMESTAMP(3);
