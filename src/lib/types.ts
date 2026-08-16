export type UserRole = "CUSTOMER" | "ADMIN" | "STAFF";

export type OrderStatus =
  | "PLACED"
  | "CONFIRMED"
  | "PREPARING"
  | "PACKED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export const ORDER_STATUSES: OrderStatus[] = [
  "PLACED",
  "CONFIRMED",
  "PREPARING",
  "PACKED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

export const STATUS_FLOW: OrderStatus[] = [
  "PLACED",
  "CONFIRMED",
  "PREPARING",
  "PACKED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export type PaymentMethod = "COD" | "UPI" | "SPLIT" | "ONLINE";
export type PaymentStatus = "PENDING" | "PARTIAL" | "PAID" | "FAILED" | "REFUNDED";
