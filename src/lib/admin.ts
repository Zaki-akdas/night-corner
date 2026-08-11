import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import type { UserRole } from "./types";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return session.user;
}

export async function requireRole(...roles: UserRole[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

export async function requireAdmin() {
  return requireRole("ADMIN");
}

export async function logActivity(params: {
  userId?: string;
  userName?: string;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId,
        userName: params.userName,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        meta: params.meta ? JSON.stringify(params.meta) : undefined,
        ip: params.ip,
      },
    });
  } catch {
    // non-critical
  }
}

export async function notifyAdmin(
  type: string,
  title: string,
  body: string
) {
  try {
    await prisma.notification.create({
      data: { type, title, body },
    });
  } catch {
    // non-critical
  }
}
