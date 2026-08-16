-- Gateway-verified payment: set by the Razorpay webhook / verify endpoint
-- when the customer's UPI payment is confirmed captured.
ALTER TABLE "Order" ADD COLUMN "paymentVerifiedAt" TIMESTAMP(3);
