import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) {
    redirect("/");
  }

  return <>{children}</>;
}
