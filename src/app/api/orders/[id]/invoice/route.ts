import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { renderInvoiceHtml } from "@/lib/invoice-html";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const order = await prisma.order.findFirst({
    where: isAdmin ? { id } : { id, userId: session.user.id },
    include: { items: true, user: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const s = await getSettings();
  const html = renderInvoiceHtml(order, {
    businessName: s.businessName,
    slogan: s.slogan,
    shopAddress: s.shopAddress,
    contactPhone: s.contactPhone,
    contactEmail: s.contactEmail,
    taxPercent: s.taxPercent,
  });

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="Invoice-${order.orderNumber}.html"`,
    },
  });
}
