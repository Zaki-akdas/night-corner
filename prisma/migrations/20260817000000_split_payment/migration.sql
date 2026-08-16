-- Split payment: customers can prepay part of the order (e.g. the delivery
-- fee) via UPI at checkout and pay the remaining balance as cash on
-- delivery. advancePaid is the prepaid amount, balanceDue the cash to
-- collect at handover.
ALTER TABLE "Order" ADD COLUMN "advancePaid" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "balanceDue" DOUBLE PRECISION NOT NULL DEFAULT 0;
