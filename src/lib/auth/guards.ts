import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, type SessionUser, sessionCookie } from "./session";

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookie.name)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function isAdminUser(user: SessionUser | null | undefined) {
  // TODO: Replace ADMIN_EMAIL gate with Cognito group-based authorization.
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const userEmail = user?.email?.trim().toLowerCase();
  return Boolean(adminEmail && userEmail && userEmail === adminEmail);
}

export async function requireCustomer() {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "customer") {
    redirect("/login");
  }
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) {
    redirect("/login");
  }
  return user;
}

export async function requireDriver() {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "driver") {
    redirect("/driver/login");
  }
  return user;
}
