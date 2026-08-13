import type { Order, OrderItem, User } from "@prisma/client";
import { formatINR } from "./settings";

export type InvoiceData = Order & {
  items: OrderItem[];
  user: Pick<User, "name" | "email" | "mobile">;
};

function escape(s: string) {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
  );
}

export function renderInvoiceHtml(
  order: InvoiceData,
  info: {
    businessName: string;
    slogan: string;
    shopAddress: string;
    contactPhone: string;
    contactEmail: string;
    taxPercent: number;
  }
): string {
  const addr = order.addressSnapshot ? JSON.parse(order.addressSnapshot) : null;
  const rows = order.items
    .map(
      (it, i) => `<tr>
      <td>${i + 1}</td>
      <td>${escape(it.name)}</td>
      <td>${escape(it.sku)}</td>
      <td>${it.quantity}</td>
      <td>${formatINR(it.unitPrice)}</td>
      <td>${formatINR(it.lineTotal)}</td>
    </tr>`
    )
    .join("");
  const addressLines = addr
    ? [
        addr.fullName,
        addr.mobile,
        [addr.house, addr.street].filter(Boolean).join(", "),
        [addr.area, addr.landmark].filter(Boolean).join(", "),
        `${addr.city} - ${addr.pincode}`,
        addr.state,
      ]
        .map((l) => `<p>${escape(l)}</p>`)
        .join("")
    : "";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
  <title>Invoice ${order.orderNumber}</title>
  <style>
  *{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f1224;margin:0;padding:40px;background:#f6f7fb}
  .sheet{max-width:820px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 10px 40px rgba(0,0,0,.08)}
  .brand{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #6d28d9;padding-bottom:20px}
  .logo{display:flex;align-items:center;gap:12px}
  .logo .mark{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#6d28d9,#38bdf8);display:grid;place-items:center;color:#fff;font-size:24px}
  .brand h1{margin:0;font-size:24px;letter-spacing:2px;background:linear-gradient(90deg,#6d28d9,#38bdf8);-webkit-background-clip:text;background-clip:text;color:transparent}
  .brand p{margin:2px 0 0;color:#64748b;font-size:12px}
  .meta{text-align:right;font-size:12px;color:#475569}.meta strong{color:#0f1224}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0}
  .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px}
  .box h3{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6d28d9}
  .box p{margin:3px 0;font-size:13px;color:#334155}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
  th{text-align:left;background:#f1f5f9;padding:10px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#475569}
  td{padding:10px;border-bottom:1px solid #e2e8f0}
  .totals{margin-top:20px;display:flex;justify-content:flex-end}
  .totals table{width:320px}.totals td{border:none;padding:6px 10px}
  .totals .grand{font-size:16px;font-weight:700;color:#6d28d9;border-top:2px solid #6d28d9}
  .status{display:inline-block;padding:4px 10px;border-radius:999px;background:#ede9fe;color:#6d28d9;font-size:11px;font-weight:600;text-transform:uppercase}
  .foot{margin-top:32px;padding-top:20px;border-top:1px dashed #cbd5e1;text-align:center;color:#64748b;font-size:12px}
  .foot .thanks{font-size:15px;color:#0f1224;font-weight:600;margin-bottom:4px}
  .table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
  @media (max-width:640px){
    body{padding:12px}
    .sheet{padding:20px;border-radius:12px}
    .brand{flex-direction:column;gap:14px}
    .meta{text-align:left}
    .grid{grid-template-columns:1fr;gap:14px}
    .totals{justify-content:stretch}
    .totals table{width:100%}
    table{font-size:12px}
    th,td{padding:8px 6px;white-space:nowrap}
    .foot{margin-top:24px;padding-top:16px}
  }
  /* Keep the printed sheet clean — drop the page tint and card shadow. */
  @media print{
    body{background:#fff;padding:0}
    .sheet{box-shadow:none;border-radius:0;max-width:none}
  }
  </style></head><body>
  <div class="sheet">
    <div class="brand">
      <div class="logo"><div class="mark">🌙</div><div>
        <h1>${escape(info.businessName)}</h1><p>${escape(info.slogan)}</p>
      </div></div>
      <div class="meta">
        <div><strong>INVOICE</strong></div>
        <div>No. ${escape(order.orderNumber)}</div>
        <div>${new Date(order.createdAt).toLocaleString("en-IN")}</div>
        <div style="margin-top:6px"><span class="status">${order.status.replace(/_/g, " ")}</span></div>
      </div>
    </div>
    <div class="grid">
      <div class="box"><h3>From</h3>
        <p><strong>${escape(info.businessName)}</strong></p>
        <p>${escape(info.shopAddress)}</p>
        <p>${escape(info.contactPhone)}</p><p>${escape(info.contactEmail)}</p>
      </div>
      <div class="box"><h3>Bill To / Ship To</h3>
        <p><strong>${escape(order.user.name ?? "Customer")}</strong></p>${addressLines}
      </div>
    </div>
    <div class="table-wrap"><table><thead><tr><th>#</th><th>Item</th><th>SKU</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody></table></div>
    <div class="totals"><table><tbody>
      <tr><td>Subtotal</td><td style="text-align:right">${formatINR(order.subtotal)}</td></tr>
      ${order.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">- ${formatINR(order.discount)}</td></tr>` : ""}
      <tr><td>Delivery</td><td style="text-align:right">${order.deliveryCharge === 0 ? "FREE" : formatINR(order.deliveryCharge)}</td></tr>
      <tr><td>Tax (${info.taxPercent}%)</td><td style="text-align:right">${formatINR(order.tax)}</td></tr>
      <tr class="grand"><td>Grand Total</td><td style="text-align:right">${formatINR(order.total)}</td></tr>
      <tr><td colSpan="2" style="font-size:11px;color:#64748b">Payment: ${order.paymentMethod} · ${order.paymentStatus}</td></tr>
    </tbody></table></div>
    <div class="foot">
      <div class="thanks">Thank you for ordering from Night Corner! 🌙</div>
      <div>Your Night. Your Essentials. · Open 10 PM – 6 AM · Delivered within 10 KM</div>
    </div>
  </div>
  <script>
    // Auto-open the print dialog so "Download Invoice" lands on Save as PDF
    // in one click. The dialog can be cancelled to just view the invoice.
    window.addEventListener("load", function () {
      setTimeout(function () { window.focus(); window.print(); }, 300);
    });
  </script>
  </body></html>`;
}
